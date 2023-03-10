// Copyright (c) 2022 Siemens

/**
 * This implements the tooltip handler interface APIs defined by aw-graph widget to provide tooltip functionalities.
 *
 * @module js/Rv1RelationBrowserTooltipHandler
 */
var exports = {};

/**
 * Function to be called to get tooltip
 *
 */
export let getTooltip = function( graphItem, graphModel ) {
    var tooltip = null;
    if( graphItem.getItemType() === 'Label' ) {
        tooltip = graphItem.getText();
    } else if( graphItem.getItemType() === 'Edge' ) {
        var label = graphItem.getLabel();
        if( label ) {
            tooltip = label.getText();
        }
    } else if( graphItem.getItemType() === 'Port' ) {
        var label = graphItem.getLabel();
        if( label ) {
            tooltip = label.getText();
        }
    } else if( graphItem.getItemType() === 'Node' ) {
        var bindData = graphItem.getAppObj();
        var proValue = bindData.Rv1Title;
        if( proValue ) {
            tooltip = bindData[ proValue ];
        }
    }
    return tooltip;
};

export default exports = {
    getTooltip
};
