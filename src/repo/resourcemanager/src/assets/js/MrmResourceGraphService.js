// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/MrmResourceGraphService
 */
import _ from 'lodash';
import logger from 'js/logger';
import templateService from 'js/MrmResourceGraphTemplateService';

var exports = {};

var _ModelObjectToNodeMap = {};

var incUpdateLayoutActive = function( layout ) {
    return layout && layout.type === 'IncUpdateLayout' && layout.isActive();
};

var sortedLayoutActive = function( layout ) {
    return layout && layout.type === 'SortedLayout' && layout.isActive();
};

/**
 * Remove objects from layout.
 */
var removeObjectsFromIncUpdateLayout = function( layout, graphItems ) {
    if ( !layout || !graphItems ) {
        return;
    }

    try {
        layout.applyUpdate( function() {
            _.each( graphItems.nodes, function( item ) {
                if ( layout.containsNode( item ) ) {
                    layout.removeNode( item );
                }
            } );
            _.each( graphItems.edges, function( item ) {
                if ( layout.containsEdge( item ) ) {
                    layout.removeEdge( item );
                }
            } );
            _.each( graphItems.ports, function( item ) {
                if ( layout.containsPort( item ) ) {
                    layout.removePort( item );
                }
            } );
        } );
    } catch ( ex ) {
        logger.error( ex );
    }
};

/**
 * Remove objects from sorted layout.
 */
var removeObjectsFromSortedLayout = function( layout, graphItems ) {
    if ( !layout || !graphItems || !sortedLayoutActive( layout ) ) {
        return;
    }

    layout.applyUpdate( function() {
        _.each( graphItems.nodes, function( item ) {
            if ( layout.containsNode( item ) ) {
                layout.removeNode( item );
            }
        } );

        _.each( graphItems.edges, function( item ) {
            if ( layout.containsEdge( item ) ) {
                layout.removeEdge( item );
            }
        } );

        _.each( graphItems.ports, function( item ) {
            if ( layout.containsPort( item ) ) {
                layout.removePort( item );
            }
        } );
    } );
};

var updateNodeMap = function( graphModel, nodes ) {
    if ( graphModel && graphModel.graphControl.graph && nodes ) {
        _.forEach( nodes, function( node ) {
            var key = _.findKey( graphModel.nodeMap, node );
            if ( key ) {
                delete graphModel.nodeMap[key];
            }
        } );
    }
};

/**
 * Hook to event awGraph.itemsRemoved
 *
 * when app detects node removal event, should also remove these nodes from layout to avoid layout crash.
 */
export let handleItemsRemovedFromGraph = function( graphModel, items ) {
    try {
        if ( !items ) {
            return;
        }

        var layout = graphModel.graphControl.layout;

        if ( incUpdateLayoutActive( layout ) ) {
            removeObjectsFromIncUpdateLayout( layout, items );
        } else if ( sortedLayoutActive( layout ) ) {
            removeObjectsFromSortedLayout( layout, items );
        }
        updateNodeMap( graphModel, items.nodes );

        _.forEach( items.nodes, function( node ) {
            // Unset the Model Object to Node mapping.
            if ( node.appData && node.appData.id && _ModelObjectToNodeMap[node.appData.id] ) {
                delete _ModelObjectToNodeMap[node.appData.id];
            }
        } );
    } catch ( ex ) {
        logger.error( ex );
    }
};

/**
 * Hook to event awGraph.graphItemsMoved
 *
 * When app detects a graph node or port move (preview) event, should re-apply an update
 * and actually execute movement of those elements.
 */
export let handleGraphItemsMoved = function( items, graphModel ) {
    var movedNodes = [];
    var movedPorts = [];
    var movedEdges = [];

    if ( items ) {
        items.forEach( function( element ) {
            if ( element.getItemType() === 'Node' ) {
                movedNodes.push( element );
            } else if ( element.getItemType() === 'Port' ) {
                movedPorts.push( element );
            } else if ( element.getItemType() === 'Edge' ) {
                movedEdges.push( element );
            }
        } );

        var layout = graphModel.graphControl.layout;

        if ( movedNodes.length > 0 || movedPorts.length > 0 || movedEdges.length > 0 ) {
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

/**
 * Hook to event awGraph.itemsAdded
 *
 * when app detects node addition event, should update the Model Object to Node mapping table.
 */
export let handleItemsAddedToGraph = function( graphModel, items ) {
    try {
        if ( !items ) {
            return;
        }

        _.forEach( items.nodes, function( node ) {
            // Set the Model Object to Node mapping.
            if ( node.appData && node.appData.id ) {
                _ModelObjectToNodeMap[node.appData.id] = node;
            }
        } );
    } catch ( ex ) {
        logger.error( ex );
    }
};

export let getNodeFromModelObjectId = function( modelObjectId ) {
    return _ModelObjectToNodeMap[modelObjectId];
};

export let handleModelObjectUpdated = function( graphModel, eventData ) {
    if ( !graphModel || !eventData ) {
        return;
    }

    if ( eventData.updatedObjects ) {
        _.forEach( eventData.updatedObjects, function( modelObject ) {
            if ( modelObject.uid ) {
                var node = exports.getNodeFromModelObjectId( modelObject.uid );

                if ( node ) {
                    // Get the updated binding data from the model object.
                    var bindData = templateService.getBindProperties( modelObject );

                    // Update the node with the new data.
                    graphModel.graphControl.graph.updateNodeBinding( node, bindData );
                }
            }
        } );
    }
    if ( eventData.relatedModified ) {
        _.forEach( eventData.relatedModified, function( modelObject ) {
            if ( modelObject.uid ) {
                var node = exports.getNodeFromModelObjectId( modelObject.uid );

                if ( node ) {
                    // Get the updated binding data from the model object.
                    var bindData = templateService.getBindProperties( modelObject );

                    // Update the node with the new data.
                    graphModel.graphControl.graph.updateNodeBinding( node, bindData );
                }
            }
        } );
    }
};

/**
 * It place the graph at center to the screen
 */
export let mrmFitGraph = function( graphModel ) {
    if ( graphModel.graphControl ) {
        _.defer( function() {
            graphModel.graphControl.fitGraph();
        } );
    }
};

/**
 * MrmResourceGraphService factory
 */

export default exports = {
    handleItemsRemovedFromGraph,
    handleGraphItemsMoved,
    handleItemsAddedToGraph,
    getNodeFromModelObjectId,
    handleModelObjectUpdated,
    mrmFitGraph
};
