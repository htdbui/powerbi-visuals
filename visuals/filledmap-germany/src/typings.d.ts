// Webpack-provided require() for bundling JSON assets
declare function require(path: string): any;

// Type declaration for .geojson imports
declare module "*.geojson" {
    const value: {
        type: "FeatureCollection";
        features: {
            type: "Feature";
            properties: Record<string, unknown>;
            geometry: unknown;
        }[];
    };
    export default value;
}
