"use strict";

import {
    formattingSettings,
    FormattingSettingsService
} from "powerbi-visuals-utils-formattingmodel";

export class ChartOptionsCardSettings extends formattingSettings.SimpleCard {
    public name: string = "chartOptions";
    public displayName: string = "Chart options";

    public orientation = new formattingSettings.ItemDropdown({
        name: "orientation",
        displayName: "Orientation",
        items: [
            { value: "vertical", displayName: "Vertical" },
            { value: "horizontal", displayName: "Horizontal" }
        ],
        value: { value: "vertical", displayName: "Vertical" }
    });

    public sortByMedian = new formattingSettings.ToggleSwitch({
        name: "sortByMedian",
        displayName: "Sort categories by median",
        value: false
    });

    public slices: formattingSettings.Slice[] = [
        this.orientation,
        this.sortByMedian
    ];
}

export class DataPointCardSettings extends formattingSettings.SimpleCard {
    public name: string = "dataPoint";
    public displayName: string = "Box colors";

    public fill = new formattingSettings.ColorPicker({
        name: "fill",
        displayName: "Box color",
        value: { value: "#4c78a8" }
    });

    public medianColor = new formattingSettings.ColorPicker({
        name: "medianColor",
        displayName: "Median color",
        value: { value: "#000000" }
    });

    public meanColor = new formattingSettings.ColorPicker({
        name: "meanColor",
        displayName: "Mean color",
        value: { value: "#ff0000" }
    });

    public slices: formattingSettings.Slice[] = [
        this.fill,
        this.medianColor,
        this.meanColor
    ];
}

export class XAxisCardSettings extends formattingSettings.SimpleCard {
    public name: string = "xAxis";
    public displayName: string = "X axis";

    public show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show",
        value: true
    });

    public showGrid = new formattingSettings.ToggleSwitch({
        name: "showGrid",
        displayName: "Show gridlines",
        value: true
    });

    public showTicks = new formattingSettings.ToggleSwitch({
        name: "showTicks",
        displayName: "Show ticks",
        value: true
    });

    public fontColor = new formattingSettings.ColorPicker({
        name: "fontColor",
        displayName: "Font color",
        value: { value: "#666666" }
    });

    public fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Text size",
        value: 11
    });

    public fontFamily = new formattingSettings.FontPicker({
        name: "fontFamily",
        displayName: "Font family",
        value: "Segoe UI"
    });

    public slices: formattingSettings.Slice[] = [
        this.show,
        this.showGrid,
        this.showTicks,
        this.fontColor,
        this.fontSize,
        this.fontFamily
    ];
}

export class YAxisCardSettings extends formattingSettings.SimpleCard {
    public name: string = "yAxis";
    public displayName: string = "Y axis";

    public show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show",
        value: true
    });

    public showGrid = new formattingSettings.ToggleSwitch({
        name: "showGrid",
        displayName: "Show gridlines",
        value: true
    });

    public showTicks = new formattingSettings.ToggleSwitch({
        name: "showTicks",
        displayName: "Show ticks",
        value: true
    });

    public fontColor = new formattingSettings.ColorPicker({
        name: "fontColor",
        displayName: "Font color",
        value: { value: "#666666" }
    });

    public fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Text size",
        value: 11
    });

    public fontFamily = new formattingSettings.FontPicker({
        name: "fontFamily",
        displayName: "Font family",
        value: "Segoe UI"
    });

    public slices: formattingSettings.Slice[] = [
        this.show,
        this.showGrid,
        this.showTicks,
        this.fontColor,
        this.fontSize,
        this.fontFamily
    ];
}

export class ShapesCardSettings extends formattingSettings.SimpleCard {
    public name: string = "shapes";
    public displayName: string = "Shapes";

    public showMedian = new formattingSettings.ToggleSwitch({
        name: "showMedian",
        displayName: "Show median",
        value: true
    });

    public showMean = new formattingSettings.ToggleSwitch({
        name: "showMean",
        displayName: "Show mean",
        value: false
    });

    public slices: formattingSettings.Slice[] = [
        this.showMedian,
        this.showMean
    ];
}

export class CategoryLabelsCardSettings extends formattingSettings.SimpleCard {
    public name: string = "categoryLabels";
    public displayName: string = "Category label layout (horizontal)";

    public layoutMode = new formattingSettings.ItemDropdown({
        name: "layoutMode",
        displayName: "Overflow handling",
        items: [
            { value: "none", displayName: "None" },
            { value: "truncate", displayName: "Truncate with ellipsis" },
            { value: "wrap", displayName: "Wrap to multiple lines" }
        ],
        value: { value: "none", displayName: "None" }
    });

    public maxLines = new formattingSettings.NumUpDown({
        name: "maxLines",
        displayName: "Max wrap lines",
        value: 2
    });

    public rotation = new formattingSettings.NumUpDown({
        name: "rotation",
        displayName: "Rotation",
        value: 0
    });

    public slices: formattingSettings.Slice[] = [
        this.layoutMode,
        this.maxLines,
        this.rotation
    ];
}

export class VisualFormattingSettingsModel extends formattingSettings.Model {
    public chartOptionsCard = new ChartOptionsCardSettings();
    public dataPointCard = new DataPointCardSettings();
    public xAxisCard = new XAxisCardSettings();
    public yAxisCard = new YAxisCardSettings();
    public shapesCard = new ShapesCardSettings();
    public categoryLabelsCard = new CategoryLabelsCardSettings();

    public cards: formattingSettings.SimpleCard[] = [
        this.chartOptionsCard,
        this.dataPointCard,
        this.xAxisCard,
        this.yAxisCard,
        this.shapesCard,
        this.categoryLabelsCard
    ];
}

export const formattingSettingsService = new FormattingSettingsService();