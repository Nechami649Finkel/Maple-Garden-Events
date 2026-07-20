import { Project, SyntaxKind, ObjectLiteralExpression, CallExpression, PropertyAssignment } from 'ts-morph';
import path from 'path';

const project = new Project({ tsConfigFilePath: path.join(__dirname, '../tsconfig.json') });
const sourceFiles = project.addSourceFilesAtPaths(path.join(__dirname, '../src/controllers') + '/**/*.ts');

function getReqParamName(node: any): string | undefined {
    const params = node.getParameters();
    for (const p of params) {
        if (p.getName() === 'req' || p.getName() === 'request' || p.getName() === '_req') return p.getName();
    }
    return undefined;
}

for (const sourceFile of sourceFiles) {
    if (sourceFile.getBaseName() === 'auth.controller.ts') continue;
    let modified = false;

    const funcs = [...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction), ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)];

    for (const func of funcs) {
        const reqName = getReqParamName(func);
        if (!reqName) continue; // Only process route handlers

        const body = func.getBody();
        if (!body || !body.getText().includes('prisma')) continue;

        if (!body.getText().includes('tenantId')) {
            if (body.getKind() === SyntaxKind.Block) {
                body.insertStatements(0, `const tenantId = (${reqName} as any).user?.tenantId;\nif (!tenantId) return res.status(403).json({ error: 'Tenant context is missing.' });`);
                modified = true;
            }
        }

        const callExprs = func.getDescendantsOfKind(SyntaxKind.CallExpression);
        for (const callExpr of callExprs) {
            const exprText = callExpr.getExpression().getText();
            if (!exprText.startsWith('prisma.') && !exprText.startsWith('tx.')) continue;
            
            const parts = exprText.split('.');
            const operation = parts[parts.length - 1];
            
            const args = callExpr.getArguments();
            if (args.length === 0 && (operation === 'findMany' || operation === 'count' || operation === 'findFirst')) {
                callExpr.addArgument('{ where: { tenantId } }');
                modified = true;
                continue;
            }
            if (args.length === 0) continue;
            
            const argObj = args[0];
            if (argObj.getKind() !== SyntaxKind.ObjectLiteralExpression) continue;
            const obj = argObj as ObjectLiteralExpression;

            if (operation === 'create' || operation === 'createMany') {
                const dataProp = obj.getProperty('data');
                if (dataProp && dataProp.getKind() === SyntaxKind.PropertyAssignment) {
                    const init = (dataProp as PropertyAssignment).getInitializer();
                    if (init && init.getKind() === SyntaxKind.ObjectLiteralExpression) {
                        const dataObj = init as ObjectLiteralExpression;
                        if (!dataObj.getProperty('tenantId')) {
                            dataObj.addPropertyAssignment({ name: 'tenantId', initializer: 'tenantId' });
                            modified = true;
                        }
                    } else if (init && init.getKind() === SyntaxKind.ArrayLiteralExpression) {
                        const arr = init.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression);
                        for (const item of arr) {
                             if (!item.getProperty('tenantId')) {
                                 item.addPropertyAssignment({ name: 'tenantId', initializer: 'tenantId' });
                                 modified = true;
                             }
                        }
                    }
                }
            } else if (['findMany', 'count', 'findFirst', 'updateMany', 'deleteMany'].includes(operation)) {
                let whereProp = obj.getProperty('where');
                if (whereProp && whereProp.getKind() === SyntaxKind.PropertyAssignment) {
                    const init = (whereProp as PropertyAssignment).getInitializer();
                    if (init && init.getKind() === SyntaxKind.ObjectLiteralExpression) {
                        const whereObj = init as ObjectLiteralExpression;
                        if (!whereObj.getProperty('tenantId')) {
                            whereObj.addPropertyAssignment({ name: 'tenantId', initializer: 'tenantId' });
                            modified = true;
                        }
                    }
                } else if (!whereProp) {
                    obj.addPropertyAssignment({ name: 'where', initializer: '{ tenantId }' });
                    modified = true;
                }
            } else if (operation === 'findUnique' || operation === 'update' || operation === 'delete') {
                const newOp = operation === 'findUnique' ? 'findFirst' : operation + 'Many';
                callExpr.getExpression().replaceWithText(exprText.replace(operation, newOp));
                let whereProp = obj.getProperty('where');
                if (whereProp && whereProp.getKind() === SyntaxKind.PropertyAssignment) {
                    const init = (whereProp as PropertyAssignment).getInitializer();
                    if (init && init.getKind() === SyntaxKind.ObjectLiteralExpression) {
                        const whereObj = init as ObjectLiteralExpression;
                        if (!whereObj.getProperty('tenantId')) {
                            whereObj.addPropertyAssignment({ name: 'tenantId', initializer: 'tenantId' });
                            modified = true;
                        }
                    }
                }
            }
        }
    }
    if (modified) sourceFile.saveSync();
}
console.log('AST Refactor Complete!');
