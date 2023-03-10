// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/MrmResourceGraphDrawService
 */
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import layoutSvc from 'js/graphLayoutService';
import node from 'js/MrmResourceGraphDrawNode';
import edge from 'js/MrmResourceGraphDrawEdge';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import performanceUtils from 'js/performanceUtils';
import logger from 'js/logger';
import graphConstants from 'js/graphConstants';
import mrmResourceGraphConstants from 'js/MrmResourceGraphConstants';
import templateService from 'js/MrmResourceGraphTemplateService';
import graphService from 'js/awGraphService';
import appCtxService from 'js/appCtxService';
import mrmResourceGraphUtils from 'js/MrmResourceGraphUtils';

var exports = {};

var layoutActive = function( layout ) {
    return layout && layout !== undefined && layout.isActive();
};

var incUpdateLayoutExpand = function( graphModel, expandDirection, seedNodes, newAddedNodes, newAddedEdges, isInitial ) {
    // If there is no layout or the current layout doesn't match what we want, we set a new one.
    var layoutPromise = AwPromiseService.instance.resolve();
    if( !graphModel.graphControl.layout || graphModel.graphControl.layout.type !== graphConstants.DFLayoutTypes.IncUpdateLayout ) {
        layoutPromise = layoutSvc.createLayout( graphModel.graphControl, graphConstants.DFLayoutTypes.IncUpdateLayout );
    }

    layoutPromise.then( function() {
        var layout = graphModel.graphControl.layout;

        if( !layout.isActive() ) {
            //apply global layout and active incremental update
            layout.applyLayout();
            layout.activate();
            return;
        }

        if( !( newAddedNodes && newAddedNodes.length > 0 ) && !( newAddedEdges && newAddedEdges.length > 0 ) ) {
            return;
        }

        var distributeDirection = graphConstants.DistributeDirections.UseLayoutDirection;

        // expand down / up / all case
        if( expandDirection === graphConstants.ExpandDirection.FORWARD ||
            expandDirection === graphConstants.ExpandDirection.BACKWARD ||
            expandDirection === graphConstants.ExpandDirection.ALL ) {
            _.each( seedNodes, function( seedNode ) {
                if(seedNode)
                {
                    layout.distributeNewNodes( seedNode, newAddedNodes, newAddedEdges, distributeDirection );
                }
            } );

            if( !isInitial ) {
                graphModel.graphControl.fitGraph();
            }
        }
    } );
};

var postApplyGraphLayout = function( ctx, contextKey, data, graphModel, newAddedNodes, newAddedEdges, isInitial, performanceTimer ) {
    if( isInitial ) {
        _.defer( function() {
            graphModel.graphControl.fitGraph();
        } );
    } else {
        if( ctx.occmgmtContext.packMode === 0 || ctx.occmgmtContext.packMode === 1 ) {
            //Update PSP icon on node after pack/unpack
            exports.updatePSPIconNodes( ctx, data, graphModel );
        }
    }

    // apply graph filters and notify item added event
    graphModel.graphControl.graph.updateOnItemsAdded( newAddedNodes.concat( newAddedEdges ) );

    performanceTimer.endAndLogTimer( 'Graph Draw Data', 'drawGraph' );

    var numberOfSelectedObjects = 0;

    var selectedObjects = appCtxService.getCtx( contextKey + '.selectedModelObjects' );

    if( selectedObjects ) {
        numberOfSelectedObjects = selectedObjects.length;
    }

    var selectedNodesUids = [];
    if ( numberOfSelectedObjects > 0 ) {
        var selectedNodeUid;
        _.forEach( selectedObjects, function( selectedObject ) {
            selectedNodeUid = selectedObject.uid;
            if ( !selectedNodesUids.includes( selectedNodeUid ) ) {
                selectedNodesUids.push( selectedNodeUid );
            }
        } );
    }

    //Select a node based on last selected object in last view mode
    setResourceGraphSelection( ctx, selectedNodesUids );
    //Select a node based on selected object in bread crumb
    eventBus.subscribe( 'breadCrumbDataProvider.selectionChangeEvent', function( event ) {
        var selectedObjects = appCtxService.ctx.occmgmtContext.selectedModelObjects;

        var selectedNodesUids = [];
        var selectedNodeUid;
        _.forEach( selectedObjects, function( selectedObject ) {
            selectedNodeUid = selectedObject.uid;
            if( !selectedNodesUids.includes( selectedNodeUid ) ) {
                selectedNodesUids.push( selectedNodeUid );
            }
        } );

        setResourceGraphSelection( ctx, selectedNodesUids );
    } );

    //Select nodes based on selected object in 3D viewer
    eventBus.subscribe( 'aceElementsSelectionUpdatedEvent', function( event ) {
        if ( ( ctx.ViewModeContext.ViewModeContext === 'ResourceView' || ctx.ViewModeContext.ViewModeContext === 'ResourceSummaryView' ) && event.isMRMAdd ) {
            var selectedNodesUids = [];
            var selectedNodeUid;
            var selectedObjects = event.objectsToSelect;
            _.forEach( selectedObjects, function( selectedObject ) {
                selectedNodeUid = selectedObject.uid;
                if ( !selectedNodesUids.includes( selectedNodeUid ) ) {
                    selectedNodesUids.push( selectedNodeUid );
                }
            } );

            event.subPanelContext.occContext.selectedModelObjects = selectedObjects;
            if( event.selectionModel ) {
                event.selectionModel.setSelection( selectedNodesUids );
            }

            setResourceGraphSelection( ctx, selectedNodesUids );
        }
    } );

    //After replacing a component it has to be removed from resource graph so that new replaced component to be added into graph
    eventBus.subscribe( 'replaceElement.elementReplacedSuccessfully', function( event ) {
        if( ctx.ViewModeContext.ViewModeContext === 'ResourceView' || ctx.ViewModeContext.ViewModeContext === 'ResourceSummaryView' ) {
            var replacedElementUID = event.replacedElementUID;
            var nodesToBeRemoved = [];
            var graphModel = ctx.graph.graphModel;
            var node = graphModel.nodeMap[ replacedElementUID ];
            nodesToBeRemoved.push( node );
            graphModel.graphControl.graph.removeNodes( nodesToBeRemoved, false );
        }
    } );

    if( !isInitial ) {
        //For any reason if graph is redraw it should reselect previous selected graph layout
        var currectLayoutDirection = graphModel.config.layout.defaultOption;
        var currectLayoutOption = mrmResourceGraphConstants.MRMResourceLayoutOptions[ currectLayoutDirection ] || 'GcTopToBottomLayout';
        graphService.setActiveLayout( graphModel, currectLayoutOption );
    }
};

export let applyGraphLayout = function( ctx, contextKey, data, graphModel, newAddedNodes, edges, isInitial, performanceTimer, sortedLayoutPreferenceValue ) {
    // Default to IncUpdateLayout.
    var layout = graphConstants.DFLayoutTypes.IncUpdateLayout;

    // Check if the sorted layout preference is set, if so, update the layout.
    if( sortedLayoutPreferenceValue && sortedLayoutPreferenceValue[ 0 ] === 'true' ) {
        layout = graphConstants.DFLayoutTypes.SortedLayout;
    }

    // Get seed node and direction
    var seedIDs;
    if( ctx.selected ) {
        seedIDs = [ ctx.selected.uid ];
    } else {
        var selectedObjects = appCtxService.getCtx( contextKey + '.selectedModelObjects' );
        if( selectedObjects && selectedObjects.length > 0 ) {
            seedIDs = [ selectedObjects[0].uid ];
        }
    }

    var expandDirection = graphConstants.ExpandDirection.FORWARD;

    var seedNodes = _.map( seedIDs, function( id ) {
        return graphModel.nodeMap[ id ];
    } );

    incUpdateLayoutExpand( graphModel, expandDirection, seedNodes, newAddedNodes, edges.addedEdges, isInitial );
    postApplyGraphLayout( ctx, contextKey, data, graphModel, newAddedNodes, edges.addedEdges, isInitial, performanceTimer );
};

/**
 * Initialize the category API on graph model. The APIs will be used to calculate legend count.
 *
 * @param graphModel the graph model object
 */
var initGraphCategoryApi = function( graphModel ) {
    graphModel.categoryApi = {
        getNodeCategory: function( node ) {
            if( node && node.appData ) {
                return node.appData.category;
            }

            return null;
        },
        getEdgeCategory: function( edge ) {
            if( edge ) {
                return edge.category;
            }
            return null;
        },
        getGroupRelationCategory: function() {
            return 'Structure';
        },
        getPortCategory: function( port ) {
            if( port ) {
                return port.category;
            }
            return null;
        }
    };
};

export let drawResourceGraph = function( ctx, contextKey, data, sortedLayoutPreferenceValue, concentratedPreferenceValue ) {
    if( !ctx.occmgmtContext.resourceLoadResult ) {
        return;
    }

    var performanceTimer = performanceUtils.createTimer();
    var topObject = cdm.getObject( ctx.state.params.uid );

    var graphModel = ctx.graph.graphModel;
    var graphData = ctx.occmgmtContext.resourceLoadResult;

    var isInitial = false;
    if( !graphModel.nodeMap ) {
        graphModel.nodeMap = {};
        isInitial = true;
        //For resource graph we are using declaritive data provider since graph's data provider works differently
        //So we need to set this declaritive data provider for the current graph model so that it is reset on "dataprovider.reset" event
        graphModel.graphDataProvider = data.dataProviders.resourceGraphDataProvider;
    }

    var activeLegendView = null;
    if( ctx.graph.legendState ) {
        activeLegendView = ctx.graph.legendState.activeView;
    }

    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var groupGraph = graphControl.groupGraph;
    var addedNodes = [];
    var edges = [];

    var bIsConcentrated = false;

    // Check if the sorted layout preference is set, if so, update the layout.
    if( concentratedPreferenceValue && concentratedPreferenceValue[ 0 ] === 'true' ) {
        bIsConcentrated = true;
    }

    if( !isInitial ) {
        var topNode = graphData.newTopNode;
        var theNode = graphModel.nodeMap[ topNode.resourceOccurrenceId ];

        if( !( theNode && groupGraph.isGroup( theNode ) ) ) {
            //Remove graph nodes and edges if they are not in newly loaded data
            exports.removeResourceGraphItems( contextKey, data, graphModel, ctx, groupGraph );
        }
    }

    // process the nodes and edges
    addedNodes = node.processNodeData( graphModel, graphData, activeLegendView );
    edges = edge.processEdgeData( graphModel, graphData, activeLegendView, bIsConcentrated );

    if( graphModel.isShowLabel === false ) {
        graph.showLabels( graphModel.isShowLabel );
    }

    if( !graphModel.categoryApi ) {
        initGraphCategoryApi( graphModel );
    }

    // This function is potentially asynchronous, anything you wish to execute after this function
    // should go in postApplyGraphLayout().
    exports.applyGraphLayout( ctx, contextKey, data, graphModel, addedNodes, edges, isInitial, performanceTimer, sortedLayoutPreferenceValue );
};

var setResourceGraphSelection = function( ctx, selectedUids ) {
    if( ctx.ViewModeContext.ViewModeContext === 'ResourceView' || ctx.ViewModeContext.ViewModeContext === 'ResourceSummaryView' ) {
        var graphModel = ctx.graph.graphModel;
        var resourceGraphNodes = graphModel.nodeMap;
        var selectResourceGraphNodes = [];
        var deSelectResourceGraphNodes = [];
        var graphControl = graphModel.graphControl;
        if( resourceGraphNodes ) {
            var deSelectResourceGraphNode;
            _.forEach( resourceGraphNodes, function( value, key ) {
                deSelectResourceGraphNode = resourceGraphNodes[ key ];
                if( deSelectResourceGraphNode.isSelected( deSelectResourceGraphNode ) ) {
                    deSelectResourceGraphNodes.push( deSelectResourceGraphNode );
                }
            } );

            if( deSelectResourceGraphNodes.length > 0 ) {
                graphControl.setSelected( deSelectResourceGraphNodes, false, false );
            }

            var selectResourceGraphNode;

            _.forEach( selectedUids, function( uid ) {
                selectResourceGraphNode = graphModel.nodeMap[ uid ];
                if( selectResourceGraphNode ) {
                    selectResourceGraphNodes.push( selectResourceGraphNode );
                }
            } );

            if( selectResourceGraphNodes.length > 0 ) {
                graphControl.setSelected( selectResourceGraphNodes, true, false );
            }
        }
    }
};

/**
 * Sets the node height and group node header height based on the wrapped text height
 */
export let setNodeHeightOnWrappedHeightChanged = function( graphModel, nodes, isStructureModifiable ) {
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var layout = graphControl.layout;
    var selectedItems = graphControl.getSelected();

    var sizeChangedNodes = [];

    _.forEach( nodes, function( nodeTextInfo ) {
        var currentWrappedHeight = nodeTextInfo.currentWrappedHeight;
        var node = nodeTextInfo.node;

        if( currentWrappedHeight ) {
            var currentHeight = node.getHeight();
            var padding = node.style.textPadding;
            var layoutHeight = currentWrappedHeight + padding;
            var newHeight = layoutHeight;

            if( newHeight > currentHeight ) {
                graph.update( function() {
                    node.setHeight( newHeight );
                } );
                sizeChangedNodes.push( node );
            }
        }

        if ( selectedItems.length === 1 && graphControl.isSelected( node ) ) {
            //If some reason height of the node changed then we need to change tranformation for add commands,
            //so that it placed on the node as per the new height of the node.
            mrmResourceGraphUtils.setGraphNodeAddCommandsTransformation( graphModel, node, isStructureModifiable );
        }
    } );

    if( layoutActive( layout ) && sizeChangedNodes.length > 0 ) {
        try {
            layout.applyUpdate( function() {
                _.forEach( sizeChangedNodes, function( sizeChangedNode ) {
                    layout.resizeNode( sizeChangedNode, true );
                } );
            } );
        } catch ( e ) {
            logger.error( e );
        }
    }
};

/**
 * It removes nodes and edges from resource graph
 *
 * @param {Object} graphModel graph model
 * @param {Object} data data object
 */
export let removeResourceGraphItems = function( contextKey, data, graphModel, ctx, groupGraph ) {
    var graphData = ctx.occmgmtContext.resourceLoadResult;
    var newNodes = graphData.childNodes;
    var existingGraphNodesUID = Object.keys( graphModel.nodeMap );

    var nodesToBeRemoved = [];

    _.forEach( existingGraphNodesUID, function( graphNodeUid ) {
        var needToRemove = true;
        _.forEach( newNodes, function( newNodeData ) {
            var newNodeObject = newNodeData;
            if( newNodeObject.uid === graphNodeUid ) {
                needToRemove = false;
            }
        } );

        if( needToRemove ) {
            var node = graphModel.nodeMap[ graphNodeUid ];
            var parent = groupGraph.getParent( node );
            //If a node has parent in a group graph it means it belongs to a group node and it will remove as part of group node
            if( parent === null ) {
                nodesToBeRemoved.push( node );
            }
        }
    } );

    if (nodesToBeRemoved.length > 0) {
        graphModel.graphControl.graph.removeNodes(nodesToBeRemoved, false);
        _.forEach(nodesToBeRemoved, function (removeNode) {
            delete graphModel.nodeMap[removeNode.appData.nodeObject.uid];
        });
    }

    var mrmAddElementInput = appCtxService.ctx.aceActiveContext.context.addElementInput;
    if( mrmAddElementInput && mrmAddElementInput.addObjectIntent && mrmAddElementInput.addObjectIntent === 'MoveIntent' ) {
        if( mrmAddElementInput.inEdgesOfCutNode ) {
            graphModel.graphControl.graph.removeEdges( mrmAddElementInput.inEdgesOfCutNode );
            delete appCtxService.ctx.occmgmtContext.addElementInput;
        }
    }

    var selectedObjects = appCtxService.getCtx( contextKey + '.selectedModelObjects' );

    var numberOfSelectedObjects = 0;
    if( selectedObjects ) {
        numberOfSelectedObjects = selectedObjects.length;
    }

    if ( numberOfSelectedObjects === 1 ) {
        var selectedNode;
        var selectedObjectsBeforeAdd = data.subPanelContext.selectionModel.selectionData.selected;

        if( selectedObjectsBeforeAdd && selectedObjectsBeforeAdd.length > 0 ) {
            selectedNode = graphModel.nodeMap[selectedObjectsBeforeAdd[0].uid];
        } else {
            selectedNode = graphModel.nodeMap[selectedObjects[0].uid];
        }

        if ( selectedNode ) {
            var edges = selectedNode.getEdges( graphConstants.EdgeDirection.IN );
            if ( edges.length > 0 ) {
                var newEdges = graphData.edges;
                var needToRemoveSelectedNodeEdge = true;
                var removedEdgeSourceNode = edges[0].getSourceNode();
                var removedEdgeTargetNode = edges[0].getTargetNode();
                var selectedNodeEdgeStartNodeUid = removedEdgeSourceNode.appData.nodeObject.uid;
                var selectedNodeEdgeEndNodeUid = removedEdgeTargetNode.appData.nodeObject.uid;
                //Check the selected node's edge in newly loaded data or not
                var newEdgeStartNodeId;
                var newEdgeEndNodeId;
                for ( var i = 0; i < newEdges.length; i++ ) {
                    newEdgeStartNodeId = newEdges[i].startNodeId;
                    newEdgeEndNodeId = newEdges[i].endNodeId;
                    if ( selectedNodeEdgeStartNodeUid === newEdgeStartNodeId && selectedNodeEdgeEndNodeUid === newEdgeEndNodeId ) {
                        //It means the edge in the newly loaded data, so no need to remove it from graph.
                        needToRemoveSelectedNodeEdge = false;
                        break;
                    }
                }

                if ( needToRemoveSelectedNodeEdge ) {
                    graphModel.graphControl.graph.removeEdges( edges );
                }
            }
        }
    }
};

/**
 * It updates PSP icon on nodes from resource graph after pack/unpack
 *
 * @param {Object} ctx the context
 * @param {Object} data data object
 * @param {Object} graphModel the graph model
 */
export let updatePSPIconNodes = function( ctx, data, graphModel ) {
    //Reloaded node objects with updated PSP information after pack/unpack

    var reloadedNodes = ctx.occmgmtContext.resourceLoadResult.childNodes;
    var topNodeUID = appCtxService.ctx.occmgmtContext.topElement.uid;
    _.forEach( reloadedNodes, function( reloadedNode ) {
        // Get the updated binding data from the model object.
        var bindData = templateService.getBindProperties( reloadedNode );

        if ( reloadedNode.props.MRMPSP ) {
            if ( topNodeUID === reloadedNode.props.awb0Parent.dbValues[0] ) {
                bindData.show_psp_image = true;
            } else {
                bindData.show_subassembly_psp_image = true;
            }
        } else {
            if ( topNodeUID === reloadedNode.props.awb0Parent.dbValues[0] ) {
                bindData.show_psp_image = false;
            } else {
                bindData.show_subassembly_psp_image = false;
            }
        }

        //Get node from existing graph        
        var graphNode = graphModel.nodeMap[reloadedNode.uid];
        if ( graphNode ) {
            // Update the node with the new data.
            graphModel.graphControl.graph.updateNodeBinding( graphNode, bindData );
        }
    } );
};

export default exports = {
    applyGraphLayout,
    drawResourceGraph,
    setNodeHeightOnWrappedHeightChanged,
    removeResourceGraphItems,
    updatePSPIconNodes
};
