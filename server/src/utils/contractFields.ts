export type ContractFieldValues = {
  isContractSigned: boolean;
  clientSignatureUrl: string | null;
};

/** Keep isContractSigned and clientSignatureUrl in sync — both require a signature image. */
export function syncContractFields(
  contractSigned: boolean | undefined | null,
  signature: string | null | undefined,
): ContractFieldValues {
  const url = signature?.trim() || null;
  return {
    isContractSigned: !!(contractSigned && url),
    clientSignatureUrl: url,
  };
}

export function hasStoredContractSignature(
  isContractSigned: boolean | undefined | null,
  clientSignatureUrl: string | null | undefined,
): boolean {
  return !!(isContractSigned && clientSignatureUrl?.trim());
}
