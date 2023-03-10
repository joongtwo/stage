// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Rv1RelationBrowserDrawService
 */
import AwPromiseService from 'js/awPromiseService';
import layoutSvc from 'js/graphLayoutService';
import node from 'js/Rv1RelationBrowserDrawNode';
import edge from 'js/Rv1RelationBrowserDrawEdge';
import _ from 'lodash';
import performanceUtils from 'js/performanceUtils';
import logger from 'js/logger';
import graphConstants from 'js/graphConstants';
import treeHelper from 'js/Rv1RelationBrowserTreeService';
import appCtxSvc from 'js/appCtxService';
import adapterSvc from 'js/adapterService';
var exports = {};

var layoutActive = function( layout ) {
    return layout && layout !== undefined && layout.isActive();
};

var getRootNode = function( seedNodes ) {
    return _.find( seedNodes, function( node ) {
        if( node ) {
            return node.isRoot();
        }
        return false;
    } );
};

/**
 * Compares two nodes based on their awp0CellProperties and returns the
 * lexicographically smaller of the two.
 *
 * @param {Object} node1 the first node object.
 * @param {Object} node2 the second node object.
 * @returns {Integer} 0 if nodes are equal, non-zero if nodes are not equal
 */
var compareNodes = function( node1, node2 ) {
    if( node1 && node2 && node1.model && node2.model ) {
        var propDBValues1 = node1.model.nodeObject.props.awp0CellProperties.dbValues;
        var propDBValues2 = node2.model.nodeObject.props.awp0CellProperties.dbValues;

        var propListLen = Math.min( Object.keys( propDBValues1 ).length, Object.keys( propDBValues2 ).length );

        for( var i = 0; i < propListLen; i++ ) {
            var prop1 = propDBValues1[ i ].substr( propDBValues1[ i ].indexOf( '\:' ) + 1 );
            var prop2 = propDBValues2[ i ].substr( propDBValues2[ i ].indexOf( '\:' ) + 1 );

            var temp = prop1.localeCompare( prop2, { numeric: true } );

            if( temp !== 0 ) {
                return temp;
            }
        }

        // Will list the object with less properties as smaller.
        return Object.keys( propDBValues1 ).length - Object.keys( propDBValues2 ).length;
    }

    return 0;
};

/**
 * Sets the layout direction as per the RB config only if it is defined and supported by current layout
 *
 * @param {Object} graphModel Graph Model
 * @param {String} legendLayout Legend Layout
 */
var setDefaultLayoutDirection = function( graphModel, legendLayout ) {
    if( legendLayout ) {
        if( graphModel.config.layout.options.indexOf( legendLayout ) > -1 ) {
            graphModel.graphControl.layout.setLayoutDirection( legendLayout );
            graphModel.update( 'config.layout.defaultOption', legendLayout );
        } else {
            logger.warn( 'The default layout ' + legendLayout +
                ' for the current view is not supported in current configuration; hence it is ignored.' );
        }
    }
};

var sortLayoutExpand = function( graphModel, legendLayout, expandDirection, seedNodes, newAddedNodes, edges, isInitial ) {
    // If there is no layout or the current layout doesn't match what we want, we set a new one.
    var layoutPromise = AwPromiseService.instance.resolve();
    if( !graphModel.graphControl.layout || graphModel.graphControl.layout.type !== graphConstants.DFLayoutTypes.SortedLayout ) {
        layoutPromise = layoutSvc.createLayout( graphModel.graphControl, graphConstants.DFLayoutTypes.SortedLayout );
        graphModel.update( 'config.layout.layoutMode', graphConstants.DFLayoutTypes.SortedLayout );
    }

    // active sorted layout the first time
    layoutPromise.then( function() {
        setDefaultLayoutDirection( graphModel, legendLayout );
        if( !layoutActive( graphModel.graphControl.layout ) ) {
            var rootNode = getRootNode( seedNodes );
            if( rootNode ) {
                graphModel.graphControl.layout.registerCompareNodesCallback( compareNodes );
                graphModel.graphControl.layout.activate( rootNode );
            }
        }

        if( !edges || edges.length === 0 ) {
            return;
        }

        // expand new items
        _.each( seedNodes, function( node ) {
            var directions = [ expandDirection ];
            if( expandDirection === graphConstants.ExpandDirection.ALL ) {
                directions = [ graphConstants.ExpandDirection.FORWARD, graphConstants.ExpandDirection.BACKWARD ];
            }

            _.each( directions, function( direction ) {
                try {
                    var nodeTree = treeHelper.buildNodeTree( edges, direction, node );
                    if( nodeTree.hasChild() ) {
                        graphModel.graphControl.layout.expand( nodeTree, nodeTree.ownEdges, direction );
                    }
                } catch ( e ) {
                    logger.error( e );
                }
            } );
        } );

        // After expanding the sorted layout the graph will need re-centered
        if( isInitial ) {
            graphModel.graphControl.fitGraph();
        }
    } );
};

var incUpdateLayoutExpand = function( graphModel, legendLayout, expandDirection, seedNodes, newAddedNodes, newAddedEdges ) {
    // If there is no layout or the current layout doesn't match what we want, we set a new one.
    var layoutPromise = AwPromiseService.instance.resolve();
    if( !graphModel.graphControl.layout || graphModel.graphControl.layout.type !== graphConstants.DFLayoutTypes.IncUpdateLayout ) {
        layoutPromise = layoutSvc.createLayout( graphModel.graphControl, graphConstants.DFLayoutTypes.IncUpdateLayout );
    }

    layoutPromise.then( function() {
        var layout = graphModel.graphControl.layout;
        setDefaultLayoutDirection( graphModel, legendLayout );

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
                layout.distributeNewNodes( seedNode, newAddedNodes, newAddedEdges, distributeDirection );
            } );
        }
    } );
};

var postApplyGraphLayout = function( graphModel, newAddedNodes, newAddedEdges, isInitial, performanceTimer ) {
    if( isInitial ) {
        _.defer( function() {
            graphModel.graphControl.fitGraph();
        } );
    }

    // apply graph filters and notify item added event
    graphModel.graphControl.graph.updateOnItemsAdded( newAddedNodes.concat( newAddedEdges ) );

    performanceTimer.endAndLogTimer( 'Graph Draw Data', 'drawGraph' );
};

export let applyGraphLayout = function( activeLegendView, data, graphModel, seedIDs, newAddedNodes, edges, isInitial, performanceTimer, sortedLayoutPreferenceValue, expandGraphData ) {
    // Default to IncUpdateLayout.
    let layout = graphConstants.DFLayoutTypes.IncUpdateLayout;

    // Check if the sorted layout preference is set, if so, update the layout.
    if( sortedLayoutPreferenceValue && sortedLayoutPreferenceValue[ 0 ] === 'true' ) {
        layout = graphConstants.DFLayoutTypes.SortedLayout;
    }

    var expandDirection = graphConstants.ExpandDirection.FORWARD;

    if( expandGraphData && expandGraphData.rootIDs ) {
        seedIDs = expandGraphData.rootIDs;
    }

    if( expandGraphData && expandGraphData.expandDirection ) {
        expandDirection = expandGraphData.expandDirection;
    }

    var seedNodes = _.map( seedIDs, function( id ) {
        return graphModel.dataModel.nodeModels[ id ].graphItem;
    } );

    let legendLayout;
    if( isInitial ) {
        legendLayout = _.get( activeLegendView, 'defaultLayout', null );
    }
    if( layout === graphConstants.DFLayoutTypes.SortedLayout && data.hasAdvancedLicense ) {
        // We only want to apply sorted layout if the license check
        // passes successfully.
        let allEdges = edges.existingEdges.concat( edges.addedEdges );
        sortLayoutExpand( graphModel, legendLayout, expandDirection, seedNodes, newAddedNodes, allEdges, isInitial );
    } else {
        incUpdateLayoutExpand( graphModel, legendLayout, expandDirection, seedNodes, newAddedNodes, edges.addedEdges );
    }
    postApplyGraphLayout( graphModel, newAddedNodes, edges.addedEdges, isInitial, performanceTimer );
};

/**
 * Initialize the category API on graph model. The APIs will be used to calculate legend count.
 *
 * @param {Object} graphModel the graph model object
 */
var initGraphCategoryApi = function( graphModel ) {
    let categoryApi = {
        getNodeCategory: function( node ) {
            if( node && node.model ) {
                return node.model.category;
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

    graphModel.categoryApi = categoryApi;
    graphModel.update( 'categoryApi', categoryApi );
};

export let drawGraph = function( activeLegendView, data, drawGraphState, sortedLayoutPreferenceValue, concentratedPreferenceValue ) {
    let performanceTimer = performanceUtils.createTimer();

    if( !activeLegendView ) {
        return;
    }

    const { graphModel } = data;
    const { graphData, expandGraphData } = { ...drawGraphState };

    let isInitial = _.isEmpty( graphModel.dataModel.nodeModels );

    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;

    var addedNodes = [];
    var edges = [];

    var bIsConcentrated = false;

    // Check if the sorted layout preference is set, if so, update the layout.
    if( concentratedPreferenceValue && concentratedPreferenceValue[ 0 ] === 'true' ) {
        bIsConcentrated = true;
    }


    let seedIDs = graphData.rootIds;
    if( _.isEmpty( seedIDs ) ) {
        const targetObjs = adapterSvc.getAdaptedObjectsSync( [ data.subPanelContext.selected ] );
        const rootId = targetObjs && targetObjs[0].uid;
        seedIDs = [ rootId ];
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

    if( isInitial ) {
        appCtxSvc.updatePartialCtx( 'graph.appActionObj', data.atomicDataRef.actionState );
    }

    // This function is potentially asynchronous, anything you wish to execute after this function
    // should go in postApplyGraphLayout().
    exports.applyGraphLayout( activeLegendView, data, graphModel, seedIDs, addedNodes, edges, isInitial, performanceTimer, sortedLayoutPreferenceValue, expandGraphData );

    return {}; // return empty object to let Declarative Model process outputData of this action
};

/**
 * Sets the node height and group node header height based on the wrapped text height
 * @param {Object} graphModel Graph Model
 * @param {Array} nodes Graph Nodes
 */
export let setNodeHeightOnWrappedHeightChanged = function( graphModel, nodes ) {
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var layout = graphControl.layout;

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
 * Rv1RelationBrowserDrawService factory
 */

export default exports = {
    applyGraphLayout,
    drawGraph,
    setNodeHeightOnWrappedHeightChanged
};
