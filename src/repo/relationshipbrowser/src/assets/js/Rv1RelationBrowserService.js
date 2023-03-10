// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Rv1RelationBrowserService
 */
import soaSvc from 'soa/kernel/soaService';
import localeSvc from 'js/localeService';
import notyService from 'js/NotyModule';
import _ from 'lodash';
import performanceUtils from 'js/performanceUtils';
import logger from 'js/logger';
import rbUtils from 'js/Rv1RelationBrowserUtils';
import graphConstants from 'js/graphConstants';
import templateService from 'js/Rv1RelationBrowserTemplateService';
import graphLayout from 'js/Rv1RelationBrowserLayout';
import adapterSvc from 'js/adapterService';

var exports = {};

// License check
let _hasAdvancedLicense;
let _missingActiveViewMsg = null;

/**
 * Get input for queryNetwork SOA input. The given graph object UIDs will be returned if it's an valid array,
 * otherwise return the primary context object UID.
 *
 * @param {String} selectedObj selected object
 * @param {Object} graphModel Graph Legend State
 * @param {Object} legendActiveView Graph Legend State
 * @param {Object} expandGraphStateValue the Expand Graph State object
 *
 * @return {Object} the queryNetwork SOA input
 */
export let getQueryNetworkInput = function( selectedObj, graphModel, legendActiveView, expandGraphStateValue ) {
    const targetObjs = adapterSvc.getAdaptedObjectsSync( [ selectedObj ] );
    const selectedUid = targetObjs && targetObjs[0] && targetObjs[0].uid;
    const expandGraphStateData = { ...expandGraphStateValue };
    try {
        if( !selectedUid || !graphModel || !legendActiveView ) {
            return;
        }

        // The object UIDs will be used as query network input if it's a valid array, otherwise take the selected object in context as root object.
        let seedIDs = [ selectedUid ];

        let expandDirection = getExpandDirection( legendActiveView, expandGraphStateData );
        let expandLevel = _.get( expandGraphStateData, 'expandLevel', '1' );
        let customFact = _.get( expandGraphStateData, 'customFact', [] );

        seedIDs = _.get( expandGraphStateData, 'rootIDs', seedIDs );

        if( !seedIDs || seedIDs.length === 0 ) {
            return;
        }

        if( expandGraphStateData && expandGraphStateData.nodes ) {
            let nodesToExpand = [];
            if( expandGraphStateData.nodes === 'all' ) {
                nodesToExpand = graphModel.graphControl.graph.getNodes();
            } else {
                nodesToExpand = graphModel.graphControl.getSelected( 'Node' );
            }

            seedIDs = _.map( nodesToExpand, 'model.id' );
        }

        if( legendActiveView ) {
            // get active view name from legend state
            const viewName = legendActiveView.internalName;

            // Remove duplicate entries.
            seedIDs = _.uniq( seedIDs );

            const graphParamMap = {
                direction: [ expandDirection ],
                level: [ expandLevel ]
            };
            if( !_.isEmpty( customFact ) ) {
                graphParamMap.customFact = customFact;
            }

            return {
                graphParamMap: graphParamMap,
                inquiries: [],
                queryMode: 'ExpandAndDegree',
                rootIds: seedIDs,
                serviceCursor: 0,
                viewName: viewName
            };
        }

        logger.error( 'Graph display issue: unable to find the Legend\'s active view name.' );
        notyService.showError( _missingActiveViewMsg );
    } catch ( ex ) {
        logger.error( ex );
    }
};

/**
 * Getting current expand direction
 *
 * @param {Object} legendActiveView active legend view
 * @param {Object} expandGraphStateData expand graph state
 * @returns {String} expand direction
 */
function getExpandDirection( legendActiveView, expandGraphStateData ) {
    let defaultExpandDirection = _.get( legendActiveView, 'defaultExpandDirection', 'forward' );
    if( _.isEmpty( defaultExpandDirection ) ) {
        defaultExpandDirection = graphConstants.ExpandDirection.FORWARD;
    }

    return _.get( expandGraphStateData, 'expandDirection', defaultExpandDirection );
}

export let getQueryNetworkOutput = function( soaResponse, data, legendActiveView ) {
    let actionState = {};
    if( !soaResponse.ServiceData.partialErrors ) {
        actionState = {
            drawGraph: {
                graphData: soaResponse.graph,
                expandGraphData: data.actionState.expandGraph
            }
        };

        if( data.actionState && data.actionState.expandGraph ) {
            actionState.drawGraph.expandGraphData.expandDirection = getExpandDirection( legendActiveView, data.actionState.expandGraph );
        }
    }
    return actionState;
};

/**
 * Toggle incoming edges visibility for the give node
 * @param {Object} graphModel Graph Model
 * @param {Object} node Node
 * @param {String} directionStr direction incoming/outgoing
 * @return {Object} action state
 */
export let toggleEdges = function( graphModel, node, directionStr ) {
    let actionStateValue = {};
    if( graphModel && node && node.model.nodeObject ) {
        const performance = performanceUtils.createTimer();

        let edgeDirection;
        let expandDirectionValue;
        if( directionStr === 'incoming' ) {
            edgeDirection = graphConstants.EdgeDirection.IN;
            expandDirectionValue = graphConstants.ExpandDirection.BACKWARD;
        } else if( directionStr === 'outgoing' ) {
            edgeDirection = graphConstants.EdgeDirection.OUT;
            expandDirectionValue = graphConstants.ExpandDirection.FORWARD;
        }

        if( edgeDirection ) {
            const edges = node.getEdges( edgeDirection );
            const visibleEdges = _.filter( edges, function( edge ) {
                return edge.isVisible();
            } );

            if( visibleEdges.length > 0 ) {
                const graph = graphModel.graphControl.graph;

                graph.removeEdges( edges );
                rbUtils.resolveConnectedGraph( graphModel );
            } else {
                actionStateValue = {
                    expandGraph: {
                        rootIDs: [ node.model.nodeObject.uid ],
                        expandDirection: expandDirectionValue
                    }
                };
            }
        }

        performance.endAndLogTimer( 'Graph Expand/Collapse Relations', 'toggleEdges' );
    }
    return actionStateValue;
};

var incUpdateLayoutActive = function( layout ) {
    return layout && layout.type === 'IncUpdateLayout' && layout.isActive();
};

var sortedLayoutActive = function( layout ) {
    return layout && layout.type === 'SortedLayout' && layout.isActive();
};

/**
 * hook to event awGraph.visibilityChanged
 *
 * a sample here only take care sortedLayout to
 * illustrate solution for LCS-92460.
 *
 * application could extend the function to take care all layout types when graph has visibility changes.
 * For complete implementation please reference:
 * src\thinclient\gc\gctestjs\src\js\Gc1TestHarnessService.js: onVisibilityChanged
 *
 * @param {Object} graphModel Graph Model
 * @param {Object} eventData Event Data
 */
export let onVisibilityChanged = function( graphModel, eventData ) {
    if( !graphModel || !eventData ) {
        return;
    }

    //handle layout
    var layout = graphModel.graphControl.layout;
    if( !sortedLayoutActive( layout ) ) {
        return;
    }

    // collect all the visibility changed nodes to layout data
    graphLayout.updateToLayout( layout, 'visibilityChanged', eventData );
};

/**
 * hook to event awGraph.filterApplied
 *
 * a sample here only take care sortedLayout to
 * illustrate solution for LCS-92460.
 *
 * application has the chance to perfrom a bunch layout update when filtre finished.
 *
 * @param {Object} graphModel Graph Model
 */
export let onFilterApplied = function( graphModel ) {
    try {
        if( !graphModel ) {
            return;
        }

        //handle layout
        var layout = graphModel.graphControl.layout;
        if( !sortedLayoutActive( layout ) ) {
            return;
        }

        graphLayout.applyLayoutUpdate( graphModel.graphControl );
    } catch ( ex ) {
        logger.error( ex );
    }
};

/**
 * Remove objects from layout.
 *
 * @param {Object} layout Graph Layout
 * @param {Array} graphItems List of graph items to be removed from layout
 */
let removeObjectsFromLayout = function( layout, graphItems ) {
    if( !layout || !graphItems ) {
        return;
    }

    try {
        layout.applyUpdate( function() {
            _.each( graphItems.nodes, function( item ) {
                if( layout.containsNode( item ) ) {
                    layout.removeNode( item );
                }
            } );
            _.each( graphItems.edges, function( item ) {
                if( layout.containsEdge( item ) ) {
                    layout.removeEdge( item );
                }
            } );
            _.each( graphItems.ports, function( item ) {
                if( layout.containsPort( item ) ) {
                    layout.removePort( item );
                }
            } );
        } );
    } catch ( ex ) {
        logger.error( ex );
    }
};

/**
 * Hook to event awGraph.itemsRemoved
 * When app detects node removal event, should also remove these nodes from layout to avoid layout crash.
 * @param {Object} graphModel Graph Model
 * @param {Object} items Removed Graph Items
 */
export let handleItemsRemovedFromGraph = function( graphModel, items ) {
    try {
        if( !items ) {
            return;
        }

        var layout = graphModel.graphControl.layout;

        if( incUpdateLayoutActive( layout ) || sortedLayoutActive( layout ) ) {
            removeObjectsFromLayout( layout, items );
        }
    } catch ( ex ) {
        logger.error( ex );
    }
};

/**
 * Hook to event awGraph.graphItemsMoved
 *
 * When app detects a graph node or port move (preview) event, should re-apply an update
 * and actually execute movement of those elements.
 *
 * @param {Array} items List of Graph Items moved
 * @param {Object} graphModel Graph Model
 */
export let handleGraphItemsMoved = function( items, graphModel ) {
    var movedNodes = [];
    var movedPorts = [];
    var movedEdges = [];

    if( items ) {
        items.forEach( function( element ) {
            if( element.getItemType() === 'Node' ) {
                movedNodes.push( element );
            } else if( element.getItemType() === 'Port' ) {
                movedPorts.push( element );
            } else if( element.getItemType() === 'Edge' ) {
                movedEdges.push( element );
            }
        } );

        var layout = graphModel.graphControl.layout;

        if( movedNodes.length > 0 || movedPorts.length > 0 || movedEdges.length > 0 ) {
            layout.applyUpdate( function() {
                _.forEach( movedNodes, function( node ) {
                    layout.moveNode( node );
                } );
                _.forEach( movedPorts, function( port ) {
                    layout.movePort( port );
                } );
                _.forEach( movedEdges, function( edge ) {
                    layout.movePort( edge );
                } );
            } );
        }
    }
};

/** -------------------------------------------------------------------
 * Use the printGraph functionality of the graphControl to open a static
 * rendering of the graph in a separate tab for printing from the browser.
 *
 * @param {Object} graphModel - The graph currently in view.
 */
export let openGraphInPrintView = function( graphModel ) {
    try {
        graphModel.graphControl.printGraph();
    } catch ( ex ) {
        logger.error( ex );
    }
};

export let updateActiveView = function( graphModel, legendData ) {
    let actionStateValue = {};
    // Update graph only when legend is initialized.
    // This method gets called during RB view initialization too,
    // (as part of listening to selection change in sub panel context) when legend is not initialized. This wil be no-op that time.
    if( legendData ) {
        try {
            graphModel.clearGraph();
            graphModel.update( 'graphControl.layout', null );
            actionStateValue = {
                expandGraph: {}
            };
        } catch ( ex ) {
            logger.error( ex );
        }
    }
    return actionStateValue;
};

/**
 * Remove Nodes, corresponding to Model Objects, from Graph
 * @param {Object} graphModel Graph Model
 * @param {Array} nodeObjects Node Model Objects
 * @returns {Object} Action State
 */
export let removeObjectsFromGraph = function( graphModel, nodeObjects ) {
    try {
        if( !graphModel || !nodeObjects || nodeObjects.length <= 0 ) {
            return;
        }

        const nodes = [];
        for( const nodeObject of nodeObjects ) {
            const nodeModel = graphModel.dataModel.nodeModels[ nodeObject.uid ];
            // cannot remove root objects
            if( nodeModel && nodeModel.graphItem && !nodeModel.graphItem.isRoot() ) {
                nodes.push( nodeModel.graphItem );
            }
        }

        if( nodes.length > 0 ) {
            graphModel.graphControl.graph.removeNodes( nodes );
            rbUtils.resolveConnectedGraph( graphModel );
        }
    } catch ( ex ) {
        logger.error( ex );
    }
    return {}; // return empty object to reset actionState
};


export let edgeHotspotClicked = function( graphModel, edge ) {
    try {
        if( edge ) {
            var graph = graphModel.graphControl.graph;
            graph.removeEdges( [ edge ] );

            rbUtils.resolveConnectedGraph( graphModel );
        }
    } catch ( ex ) {
        logger.error( ex );
    }
};

export let handleModelObjectUpdated = function( graphModel, eventData ) {
    if( !graphModel || !eventData ) {
        return;
    }

    let updatedModelObjects = [];

    if( eventData.updatedObjects ) {
        updatedModelObjects = updatedModelObjects.concat( eventData.updatedObjects );
    }
    if( eventData.relatedModified ) {
        updatedModelObjects = updatedModelObjects.concat( eventData.relatedModified );
    }

    _.forEach( updatedModelObjects, function( modelObject ) {
        if( modelObject.uid ) {
            let nodeModel = graphModel.dataModel.nodeModels[ modelObject.uid ];
            if( nodeModel && nodeModel.graphItem ) {
                // Get the updated binding data from the model object.
                var bindData = templateService.getBindProperties( modelObject );

                // Update the node with the new data.
                graphModel.graphControl.graph.updateNodeBinding( nodeModel.graphItem, bindData );
            }
        }
    } );
};

/**
 * Creates an SOA request for the System Modeler license. If the
 * key is valid, we resolve the hasAdvancedFeatures promise. Otherwise,
 * we reject.
 */
let checkSystemModelerLicense = async function() {
    try {
        await soaSvc.post( 'Core-2019-06-Session', 'licenseAdmin', { licAdminInput: [ { featureKey: 'tc_system_modeler', licensingAction: 'get' } ] } );
        return true; // license check SOA call will throw error if it is unable to check-out the license
    } catch( exception ) {
        logger.info( 'Failed to get the System Modeler license.' );
    }

    return false;
};

/**
 * Creates an SOA request for the Impact Analysis license. If the
 * key is valid, we resolve the hasAdvancedFeatures promise. Otherwise,
 * we attempt to validate the System Modeler license.
 */
let checkImpactAnalysisLicense = async function() {
    try {
        await soaSvc.post( 'Core-2019-06-Session', 'licenseAdmin', { licAdminInput: [ { featureKey: 'impact_analysis', licensingAction: 'get' } ] } );
        return true;
    } catch( exception ) {
        logger.info( 'Failed to get the Impact Analysis license.' );
    }

    return false;
};

/**
 * Checks if the session has valid licenses to enable the
 * Advanced Features. If yes, returns promise with true.
 */
export let checkForAdvancedFeaturesLicenses = async function() {
    if( _.isNil( _hasAdvancedLicense ) ) {
        return checkImpactAnalysisLicense().then( async function( hasLicense ) {
            if( !hasLicense ) {
                hasLicense = await checkSystemModelerLicense();
            }

            _hasAdvancedLicense = hasLicense;
            return hasLicense;
        } );
    }

    return _hasAdvancedLicense;
};

/**
 * Initialization
 */
const loadConfiguration = () => {
    localeSvc.getTextPromise( 'RelationBrowserMessages', true ).then(
        function( localTextBundle ) {
            _missingActiveViewMsg = localTextBundle.missingActiveView;
        } );
};

loadConfiguration();

/**
 * Rv1RelationBrowserService factory
 */

export default exports = {
    getQueryNetworkInput,
    getQueryNetworkOutput,
    toggleEdges,
    onVisibilityChanged,
    onFilterApplied,
    handleItemsRemovedFromGraph,
    handleGraphItemsMoved,
    openGraphInPrintView,
    updateActiveView,
    removeObjectsFromGraph,
    edgeHotspotClicked,
    handleModelObjectUpdated,
    checkForAdvancedFeaturesLicenses
};
