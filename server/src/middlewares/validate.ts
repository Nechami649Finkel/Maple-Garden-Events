import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema): RequestHandler => 
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // בודק את הנתונים מול החוקים שהגדרנו
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next(); // הכל תקין, ממשיכים לקונטרולר
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: 'שגיאת אימות נתונים - נא לבדוק את השדות שהוזנו.',
        
          errors: error.issues.map(e => ({ 
            field: e.path[e.path.length - 1], 
            message: e.message 
          }))
        });
        return;
      }
      next(error);
    }
};