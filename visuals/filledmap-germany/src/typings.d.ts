// src/typings.d.ts

// Declare require so TS accepts it
declare function require(path: string): any;

// Optional: JSON module typing
declare module "*.json" {
    const value: any;
    export default value;
}

// Allow importing GeoJSON and other JSON-like assets
declare module "*.geojson" {
    const value: any;
    export default value;
}

// Allow require(...) calls in TypeScript
declare function require(path: string): any;