/**
 * Type declarations for external modules without TypeScript definitions
 */

declare module "circomlibjs" {
  export function buildPoseidon(): Promise<{
    F: {
      toString(value: any): string;
      e(value: string | number | bigint): any;
    };
    (inputs: (string | number | bigint)[]): any;
  }>;
}

declare module "snarkjs" {
  export namespace groth16 {
    function fullProve(
      input: Record<string, any>,
      wasmPath: string,
      zkeyPath: string
    ): Promise<{
      proof: {
        pi_a: [string, string, string];
        pi_b: [[string, string], [string, string], [string, string]];
        pi_c: [string, string, string];
        protocol: string;
        curve: string;
      };
      publicSignals: string[];
    }>;

    function verify(
      verificationKey: any,
      publicSignals: string[],
      proof: any
    ): Promise<boolean>;

    function exportSolidityCallData(
      proof: any,
      publicSignals: string[]
    ): Promise<string>;
  }

  export namespace zKey {
    function exportVerificationKey(zkeyPath: string): Promise<any>;
  }
}
