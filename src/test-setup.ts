import { Blob as NodeBlob } from "node:buffer";
Object.defineProperty(globalThis, "Blob", {
  value: NodeBlob,
  configurable: true,
});
