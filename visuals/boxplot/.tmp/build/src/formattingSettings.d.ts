import { formattingSettings, FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
export declare class ChartOptionsCardSettings extends formattingSettings.SimpleCard {
    name: string;
    displayName: string;
    orientation: formattingSettings.ItemDropdown;
    sortByMedian: formattingSettings.ToggleSwitch;
    slices: formattingSettings.Slice[];
}
export declare class DataPointCardSettings extends formattingSettings.SimpleCard {
    name: string;
    displayName: string;
    fill: formattingSettings.ColorPicker;
    medianColor: formattingSettings.ColorPicker;
    meanColor: formattingSettings.ColorPicker;
    slices: formattingSettings.Slice[];
}
export declare class XAxisCardSettings extends formattingSettings.SimpleCard {
    name: string;
    displayName: string;
    show: formattingSettings.ToggleSwitch;
    showGrid: formattingSettings.ToggleSwitch;
    showTicks: formattingSettings.ToggleSwitch;
    fontColor: formattingSettings.ColorPicker;
    fontSize: formattingSettings.NumUpDown;
    fontFamily: formattingSettings.FontPicker;
    slices: formattingSettings.Slice[];
}
export declare class YAxisCardSettings extends formattingSettings.SimpleCard {
    name: string;
    displayName: string;
    show: formattingSettings.ToggleSwitch;
    showGrid: formattingSettings.ToggleSwitch;
    showTicks: formattingSettings.ToggleSwitch;
    fontColor: formattingSettings.ColorPicker;
    fontSize: formattingSettings.NumUpDown;
    fontFamily: formattingSettings.FontPicker;
    slices: formattingSettings.Slice[];
}
export declare class ShapesCardSettings extends formattingSettings.SimpleCard {
    name: string;
    displayName: string;
    showMedian: formattingSettings.ToggleSwitch;
    showMean: formattingSettings.ToggleSwitch;
    slices: formattingSettings.Slice[];
}
export declare class CategoryLabelsCardSettings extends formattingSettings.SimpleCard {
    name: string;
    displayName: string;
    layoutMode: formattingSettings.ItemDropdown;
    maxLines: formattingSettings.NumUpDown;
    rotation: formattingSettings.NumUpDown;
    slices: formattingSettings.Slice[];
}
export declare class VisualFormattingSettingsModel extends formattingSettings.Model {
    chartOptionsCard: ChartOptionsCardSettings;
    dataPointCard: DataPointCardSettings;
    xAxisCard: XAxisCardSettings;
    yAxisCard: YAxisCardSettings;
    shapesCard: ShapesCardSettings;
    categoryLabelsCard: CategoryLabelsCardSettings;
    cards: formattingSettings.SimpleCard[];
}
export declare const formattingSettingsService: FormattingSettingsService;
