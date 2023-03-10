// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/MrmResourceGraphSelectionService
 */
import appCtxSvc from 'js/appCtxService';
import drawEdgeService from 'js/MrmResourceGraphDrawEdge';
import _ from 'lodash';
import logger from 'js/logger';
import mrmResourceGraphUtils from 'js/MrmResourceGraphUtils';

var exports = {};

var NODE_HOVERED_CLASS = 'relation_node_hovered_style_svg';
var TEXT_HOVERED_CLASS = 'relation_text_hovered_style_svg';
var NODE_DEFAULT_CLASS = 'aw-graph-noeditable-area';

/** -------------------------------------------------------------------
 * Update the AW selection service so it knows about the element(s) selected.
 * The AW selection service keeps the model object so it can be used elsewhere
 * to show data from the selected object.
 * If more than one node is selected, the last selected node of the graph is used.
 *
 * @param {Object} graphModel - The graph model object
 * @param {Object} eventData - The list of nodes and edges currently selected in the graph
 */
function updateAWSelectionService( graphModel, selectedItems, selectionModel ) {
    if( selectionModel ) {
        if( selectedItems.length >= 1 ) {
            var selectedNodesUids = [];
            _.forEach( selectedItems, function( selectedObject ) {
                if( selectedObject.getItemType() === 'Node' ) {
                    var selectedNodeUid = selectedObject.appData.nodeObject.uid;
                    if( !selectedNodesUids.includes( selectedNodeUid ) ) {
                        selectedNodesUids.push( selectedNodeUid );
                    }
                }
            } );
            if( selectedNodesUids.length <= 0 ) {
                selectedNodesUids.push( graphModel.resourceRootId );
            }

            selectionModel.setSelection( selectedNodesUids );
        } else if( graphModel.numSelected === 0 ) { // User has deselected everything.
            selectionModel.setSelection( graphModel.resourceRootId );
        }
    }
}

/** -------------------------------------------------------------------
 * Handle the awGraph.selectionChanged event.
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} eventData - data pertinent to the selectionChanged event.  @see setSelected() in graphControlFactory.js
 */
export let graphSelectionChanged = function( graphModel, eventData, selectionModel, isStructureModifiable ) {
    try {
        var selectedItems = graphModel.graphControl.getSelected();
        graphModel.numSelected = selectedItems.length;

        const occContext = appCtxSvc.getCtx( 'occmgmtContext' );
        let newOccContext = { ...occContext };

        if( newOccContext ) {
            newOccContext.isRootOrSubAssemblyNodeInSelection = isRootOrSubAssemblyNodeInSelection( selectedItems );
            newOccContext.numberOfGCSSockets = 0;
            if ( selectedItems.length === 1 && selectedItems[0].getItemType() === 'Node' ) {
                if ( selectedItems[0].appData.nodeObject.props.NUMOFGCSSOCKETS ) {
                    newOccContext.numberOfGCSSockets = parseInt( selectedItems[0].appData.nodeObject.props.NUMOFGCSSOCKETS );
                }
            }

            appCtxSvc.updateCtx( 'occmgmtContext', newOccContext );
        }

        // Unset the hover style from all nodes and edges that are, or were, selected.  Otherwise, nodes that get
        // unselected could still have the hover style.
        setHoverStyles( graphModel, _.union( selectedItems, eventData.unSelected ), false );
        updateAWSelectionService( graphModel, selectedItems, selectionModel );
        if( newOccContext ) {
            mrmResourceGraphUtils.showHideAddCommandsOnSelection( graphModel, isStructureModifiable );
        }
    } catch ( ex ) {
        logger.error( ex );
    }
};

/**
 * @return true if current selection contains a top component or sub component from sub assembly.
 */
function isRootOrSubAssemblyNodeInSelection( selectedItems ) {
    var rootOrSubAssemblyNodeInSelection = false;
    if ( selectedItems.length >= 1 ) {
        if ( appCtxSvc.ctx.occmgmtContext.topElement ) {
            var topElementUID = appCtxSvc.ctx.occmgmtContext.topElement.uid;
            _.forEach( selectedItems, function( selectedObject ) {
                if ( selectedObject.getItemType() === 'Node' ) {
                    var selectedNode = selectedObject.appData.nodeObject;
                    if ( topElementUID === selectedNode.uid || topElementUID !== selectedNode.props.awb0Parent.dbValues[0] ) {
                        rootOrSubAssemblyNodeInSelection = true;
                        return;
                    }
                }
            } );
        }
    }

    return rootOrSubAssemblyNodeInSelection;
}

/** -------------------------------------------------------------------
 * Set the hovered style of a node.
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} nodes - the graph nodes on which to apply a style
 * @param {String} isHovered - true if the node is being hovered over
 *
 * Applying a node style, as is done here, is a two step process.  First, update the relevant properties kept by
 * the node.  Then call updateNodeBinding to apply properties to the SVG/DOM.
 * Node (fill, stroke, etc.) and text styling will be specified in the single node-hovered styling class in graphModel.hoverStyle.node.
 */
function setNodeHoverStyle( graphModel, nodes, isHovered ) {
    for( var i = 0; i < nodes.length; i++ ) {
        var node = nodes[ i ];
        if( node ) {
            var bindingData = {};

            if( isHovered ) {
                bindingData[ NODE_HOVERED_CLASS ] = graphModel.hoverStyle.node;
                bindingData[ TEXT_HOVERED_CLASS ] = graphModel.hoverStyle.node;
            } else {
                bindingData[ NODE_HOVERED_CLASS ] = NODE_DEFAULT_CLASS;
                bindingData[ TEXT_HOVERED_CLASS ] = '';
            }

            graphModel.graphControl.graph.updateNodeBinding( node, bindingData );
        }
    }
}

/** -------------------------------------------------------------------
 * Set the style of an edge and the associated nodes to hovered, or standard depending on parameter isHovered.
 *
 * @param {Object} graphModel - The graph model object.
 * @param {Object} edge - The edge on which to set the style.
 * @param {String} isHovered - true if the edge is being hovered over.
 */
function setEdgeHoverStyle( graphModel, edge, isHovered ) {
    if( !edge.style ) {
        return;
    }

    drawEdgeService.setEdgeStyle( graphModel, edge, isHovered );
    setNodeHoverStyle( graphModel, [ edge.getSourceNode(), edge.getTargetNode() ], isHovered );
}

/** -------------------------------------------------------------------
 * Set the hover style for multiple nodes and edges.
 *
 * @param {Object} graphModel - The graph model object.
 * @param {Array<Object>} elements - The array of nodes and edges on which to set the style.
 * @param {boolean} isHovered - true if the element is being hovered over.
 */
function setHoverStyles( graphModel, elements, isHovered ) {
    if( !elements || elements.length === 0 ) {
        return;
    }
    var edges = elements.filter( function( elem ) { return elem && elem.getItemType() === 'Edge'; } );
    var nodes = elements.filter( function( elem ) { return elem && elem.getItemType() === 'Node'; } );
    for( var i = 0; i < edges.length; i++ ) {
        nodes.push( edges[ i ].getSourceNode() );
        nodes.push( edges[ i ].getTargetNode() );
        drawEdgeService.setEdgeStyle( graphModel, edges[ i ], isHovered );
    }
    nodes = _.uniq( nodes );
    setNodeHoverStyle( graphModel, nodes, isHovered );
}

/**
 * Checks if multiple nodes are selected.
 *
 * @param {Object} graphModel - The graph model object.
 */
function isMultipleNodeSelected( graphModel ) {
    var selectedElements = graphModel.graphControl.getSelected();
    var selectedNodes = selectedElements.filter( function( elem ) { return elem.getItemType() === 'Node'; } );

    if ( selectedNodes && selectedNodes.length > 1 ) {
        return true;
    }
    return false;
}

/** -------------------------------------------------------------------
 * Graph hover-changed handler
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} eventData - contains the hovered and/or unhovered items from the graph
 */
export let graphHoverChanged = function( graphModel, eventData, isStructureModifiable ) {
    try {
        if ( !graphModel || !eventData ) {
            return;
        }
        var unHoveredItem = eventData.unHoveredItem;
        var hoveredItem = eventData.hoveredItem;

        if ( unHoveredItem ) {
            if ( !unHoveredItem.isSelected() || isMultipleNodeSelected( graphModel ) ) {
                if ( unHoveredItem.getItemType() === 'Edge' ) {
                    setEdgeHoverStyle( graphModel, unHoveredItem, false );
                } else if ( unHoveredItem.getItemType() === 'Node' ) {
                    setNodeHoverStyle( graphModel, [ unHoveredItem ], false );
                    mrmResourceGraphUtils.showHideAddCommandsOnMouseHovered( graphModel, hoveredItem, false, isStructureModifiable );
                }
            }
        }

        if ( hoveredItem ) {
            if ( !hoveredItem.isSelected() || isMultipleNodeSelected( graphModel ) ) {
                if ( hoveredItem.getItemType() === 'Edge' ) {
                    setEdgeHoverStyle( graphModel, hoveredItem, true );
                } else if ( hoveredItem.getItemType() === 'Node' ) {
                    setNodeHoverStyle( graphModel, [ hoveredItem ], true );
                    mrmResourceGraphUtils.showHideAddCommandsOnMouseHovered( graphModel, hoveredItem, true, isStructureModifiable );
                }
            }
        }
    } catch ( ex ) {
        logger.debug( ex );
    }
};

export default exports = {
    graphSelectionChanged,
    graphHoverChanged
};
