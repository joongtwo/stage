// Copyright (c) 2022 Siemens

/**
 * This implements the tooltip handler interface APIs defined by mrm aw-graph widget to provide tooltip functionalities.
 *
 * @module js/MrmResourceGraphTooltipHandler
 */
import appCtxService from 'js/appCtxService';
import mrmResourceGraphUtils from 'js/MrmResourceGraphUtils';

var exports = {};

/**
 * It returns tool tip for given graph item
 * @param {Object} graphItem - the graph item
 * @param {Object} graphModel - the graph model object 
 */
export let getTooltip = function( graphItem, graphModel ) {
    var tooltip = null;
    if ( graphItem.getItemType() === 'Label' ) {
        tooltip = graphItem.getText();
    } else if ( graphItem.getItemType() === 'Edge' ) {
        var label = graphItem.getLabel();
        if ( label ) {
            tooltip = label.getText();
        }
    } else if ( graphItem.getItemType() === 'Port' ) {
        var label = graphItem.getLabel();
        if ( label ) {
            tooltip = label.getText();
        }
    } else if ( graphItem.getItemType() === 'Node' ) {
        var topNodeUID = appCtxService.ctx.occmgmtContext.topElement.uid;
        var currentNodeObject = graphItem.appData.nodeObject;
        var currentNodeUID = currentNodeObject.uid;
        if ( topNodeUID === currentNodeUID || topNodeUID === currentNodeObject.props.awb0Parent.dbValues[0] ) {
            var bindData = graphItem.getAppObj();
            var proValue = bindData.Title;
            if ( proValue ) {
                tooltip = bindData[proValue];
            }
        } else {
            //If it is a node from a sub assembly then it should show a tooltip in below format.
            //Add a component to the subassembly by opening
            //"<sub-assy-name> - <sub-assy-ID>/<sub-assy-revision>" as a root node.
            var graphControl = graphModel.graphControl;
            var groupGraph = graphControl.groupGraph;
            var parentOfGraphItem = groupGraph.getParent( graphItem );

            var subAssemblyName = parentOfGraphItem.getProperty( 'Element' );
            var subAssemblyID = parentOfGraphItem.getProperty( 'ID' );

            var revProp = parentOfGraphItem.getProperty( 'Revision' );
            var revPropArray = revProp.split( ':' );

            var subAssemblyIDRevision = revPropArray[1].trim();

            var subAssemblyInfo = subAssemblyName + ' - ' + subAssemblyID + '/' + subAssemblyIDRevision;
            tooltip = mrmResourceGraphUtils.getMRMGraphLocalizedMessage( 'MRM0SubAssemblyComponentsTooltip', subAssemblyInfo );
        }
    }
    return tooltip;
};

export default exports = {
    getTooltip
};
