import "core-js";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
export declare class Visual implements IVisual {
    private host;
    private svg;
    private mainGroup;
    private tooltipServiceWrapper;
    constructor(options: VisualConstructorOptions);
    update(options: VisualUpdateOptions): void;
    private clear;
    private transform;
    private render;
}
