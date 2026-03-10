import "core-js";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import FormattingModel = powerbi.visuals.FormattingModel;
export declare class Visual implements IVisual {
    private host;
    private svg;
    private mainGroup;
    private tooltipServiceWrapper;
    private selectionManager;
    private formattingSettings;
    private settings;
    constructor(options: VisualConstructorOptions);
    update(options: VisualUpdateOptions): void;
    private clear;
    /**
     * Transform the categorical DataView into a BoxplotViewModel.
     * Assumes:
     *  - categories[0] = Category
     *  - categories[1] = Sampling (optional)
     *  - values[0] = Values measure (used for boxplot)
     *  - values[1] = Tooltips measure (optional, not used in stats)
     */
    private transform;
    private render;
    enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration;
    getFormattingModel(): FormattingModel;
}
