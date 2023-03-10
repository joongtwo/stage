// Copyright (c) 2022 Siemens

/**
 * This is an implementation for graphDataProvider for PERT
 *
 * @module js/epPertGraphRenderService
 */
import { getBaseUrlPath } from 'app';
import _ from 'lodash';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import _awIconSvc from 'js/awIconService';
import epPertEditService from 'js/epPertEditService';
import epObjectPropertyCacheService from 'js/epObjectPropertyCacheService';
import localeService from 'js/localeService';

const NODE_SIDE_BAR_CLASS = 'aw-epPert-processSideBar';
const EXTERNAL_PREDECESSORS = 'ExternalPredecessors';
const EXTERNAL_SUCCESSORS = 'ExternalSuccessors';

/**
 * It will be called for pre process before the graph data been renderred completely.
 * @param {Object} graphModel graphmodel
 * @param {Object} rawGraphData rawGraphData
 */
export function preDraw( graphModel, rawGraphData ) {
    let edgeId;
    if( !graphModel ) {
        return;
    }
    graphModel.clearGraph();
    rawGraphData.nodes.forEach( node => {
        if( node.props.Mfg0predecessors && node.props.Mfg0predecessors.dbValues.length > 0 ) {
            node.props.Mfg0predecessors.dbValues.forEach( pred => {
                const edgeData = {
                    id: `edge_id${Math.random().toString()}`,
                    puid: pred,
                    suid: node.uid,
                    props: {}
                };
                if( !epPertEditService.doesEdgeAlreadyExistBetweenNodes( graphModel.dataModel.edgeModels, edgeData.puid, edgeData.suid ) ) {
                    rawGraphData.edges.push( edgeData );
                } else {
                    for( const edge in graphModel.dataModel.edgeModels ) {
                        if( graphModel.dataModel.edgeModels[ edge ].edgeObject.suid === edgeData.puid && graphModel.dataModel.edgeModels[ edge ].edgeObject.puid === edgeData.suid ) {
                            delete graphModel.dataModel.edgeModels[ edge ];
                            rawGraphData.edges.push( edgeData );
                        }
                    }
                }
            } );
        }
    } );
}

/**
 * It will be called for post process after the graph data been renderred completely.
 * We can define some graph layout logic here.
 * @param {Object} graphModel graphmodel
 */
export function postDraw( graphModel ) {
    const graphControl = graphModel.graphControl;
    graphControl.layout.applyLayout();
    graphControl.layout.activate();
    _.defer( function() {
        graphControl.fitGraph();
    } );
}

/**
 * API to get node style. The node style can either be a template node or a symbol node.
 * @returns {Object} nodeStyle
 */
export function getNodeStyle() {
    return {
        templateId: 'epPertNodeTemplate'
    };
}

/**
 * API to get Edge style. The Edge style from config.
 * @param {Object} graphModel graphmodel
 * @param {Object} edgeModel  edgeModel
 */
export function getEdgeStyle( graphModel, edgeModel ) {
    return graphModel.config.defaults.edgeStyle;
}

/**
 * API to get node binding data for template node.
 * @param {Object} graphModel graphModel
 * @param {Object} nodeModel nodeModel
 * @returns {Object} Data to be displayed in given node
 */
export function getNodeBindData( graphModel, nodeModel ) {
    const bindData = {};
    bindData.id = nodeModel.modelObject.uid;
    bindData.nodeTitle = nodeModel.modelObject.props[ epBvrConstants.BL_REV_OBJECT_NAME ].dbValues[ 0 ];
    bindData.nodeSubTitle = nodeModel.modelObject.props[ epBvrConstants.OBJECT_STRING ].dbValues[ 0 ].split( '-' )[ 0 ];
    bindData.nodeImageValue = _awIconSvc.getTypeIconFileUrl( nodeModel.modelObject );
    bindData.nodeSidebarClass = NODE_SIDE_BAR_CLASS;
    bindData.isNodeHovered = false;

    // if we set to empty , then image will not get displayed
    bindData.releaseImage = '';
    bindData.releaseImageTooltip = '';
    bindData.workflowImage = '';
    bindData.workflowImageTooltip = '';

    const localTextBundle = localeService.getLoadedText( 'PertMessages' );
    const externalPredecessors = epObjectPropertyCacheService.getProperty( nodeModel.modelObject.uid, EXTERNAL_PREDECESSORS );
    const externalSuccessors = epObjectPropertyCacheService.getProperty( nodeModel.modelObject.uid, EXTERNAL_SUCCESSORS );
    if( externalPredecessors && externalPredecessors.length > 0 ) {
        bindData.hasExternalPredecessors = getBaseUrlPath() + '/image/indicatorHasExternalPredecessors20.svg';
        bindData.hasExternalPredecessorsImageTooltip = localTextBundle.hasExternalPredecessorsTooltip;
        bindData.hasExternalPredecessorsValue = getTransformValue( 14, 80 );
    } else {
        bindData.hasExternalPredecessors = null;
        bindData.hasExternalPredecessorsImageTooltip = null;
        bindData.hasExternalPredecessorsValue = null;
    }

    if( externalSuccessors && externalSuccessors.length > 0 ) {
        bindData.hasExternalSuccessors = getBaseUrlPath() + '/image/indicatorHasExternalSuccessors20.svg';
        bindData.hasExternalSuccessorsImageTooltip = localTextBundle.hasExternalSuccessorsTooltip;
        bindData.hasExternalSuccessorsValue = externalPredecessors.length ? getTransformValue( 35, 80 ) : getTransformValue( 14, 80 );
    } else {
        bindData.hasExternalSuccessors = null;
        bindData.hasExternalSuccessorsImageTooltip = null;
        bindData.hasExternalSuccessorsValue = null;
    }

    // workflow
    if( nodeModel.modelObject.indicators ) {
        if( nodeModel.modelObject.indicators.length === 1 && nodeModel.modelObject.indicators[ 0 ].release ) {
            bindData.releaseImage = nodeModel.modelObject.indicators[ 0 ].release.image;
            bindData.releaseImageTooltip = nodeModel.modelObject.indicators[ 0 ].release.tooltip;
            bindData.releaseImageTransformValue = getTransformValue( 220, 80 );
        } else if( nodeModel.modelObject.indicators.length === 1 && nodeModel.modelObject.indicators[ 0 ].workflow ) {
            bindData.workflowImage = nodeModel.modelObject.indicators[ 0 ].workflow.image;
            bindData.workflowImageTooltip = nodeModel.modelObject.indicators[ 0 ].workflow.tooltip;
            bindData.workflowImageTransformValue = getTransformValue( 220, 80 );
        } else if( nodeModel.modelObject.indicators.length === 2 ) {
            bindData.releaseImage = nodeModel.modelObject.indicators[ 0 ].release.image;
            bindData.releaseImageTooltip = nodeModel.modelObject.indicators[ 0 ].release.tooltip;
            bindData.workflowImage = nodeModel.modelObject.indicators[ 1 ].workflow.image;
            bindData.workflowImageTooltip = nodeModel.modelObject.indicators[ 1 ].workflow.tooltip;
            bindData.releaseImageTransformValue = getTransformValue( 220, 80 );
            bindData.workflowImageTransformValue = getTransformValue( 190, 80 );
        }
    }
    return bindData;
}

/**
 * returns the transform attribute value based on the 'x' and 'y' positioning
 *
 * @param xPos - the 'x' position
 * @param yPos - the 'y' position
 */
let getTransformValue = function( xPos, yPos ) {
    return 'translate(' + xPos + ' ' + yPos + ')';
};

// eslint-disable-next-line no-unused-vars
let exports = {};
export default exports = {
    postDraw,
    getNodeStyle,
    getNodeBindData,
    preDraw,
    getEdgeStyle
};
