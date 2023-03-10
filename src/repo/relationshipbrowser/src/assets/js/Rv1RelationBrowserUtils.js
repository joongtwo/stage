// Copyright (c) 2022 Siemens

/**
 * This module defines graph utils
 *
 * @module js/Rv1RelationBrowserUtils
 */
import _ from 'lodash';
import logger from 'js/logger';
import graphConstants from 'js/graphConstants';
import graphPathsService from 'js/graphPathsService';
import AwPromiseService from 'js/awPromiseService';
import contributionService from 'js/contribution.service';

var _awldfDialogUtilsService = null;

var exports = {};

var rootNodeFilter = function( item ) {
    return item.isRoot();
};

var getNextLevelNodes = function( node ) {
    var nextLevelNodes = [];

    if( node.getItemType() !== 'Node' ) {
        return;
    }

    var edges = node.getEdges();
    var visibleEdges = _.filter( edges, function( edge ) {
        return edge.isVisible();
    } );

    _.forEach( visibleEdges, function( edge ) {
        if( edge.getSourceNode() === node ) {
            if( edge.getTargetNode().isVisible() ) {
                nextLevelNodes.push( edge.getTargetNode() );
            }
        } else if( edge.getTargetNode() === node ) {
            if( edge.getSourceNode().isVisible() ) {
                nextLevelNodes.push( edge.getSourceNode() );
            }
        }
    } );

    nextLevelNodes = _.uniq( nextLevelNodes );

    return nextLevelNodes;
};

/**
 * getFilteredCounts
 */
export let getFilteredCounts = function( legend, rootNodes, node ) {
    var inDegrees = node.model.inDegrees;
    var outDegrees = node.model.outDegrees;

    var counts = {
        inDegrees: inDegrees.slice(),
        outDegrees: outDegrees.slice()
    };

    var source = [];
    var target = [];

    var edges = node.getEdges();
    var visibleEdges = _.filter( edges, function( edge ) {
        return edge.isVisible();
    } );

    // Since the root node cannot be hidden it must be excluded for other nodes
    for( var x = 0; x < visibleEdges.length; ++x ) {
        for( var y = 0; y < rootNodes.length; ++y ) {
            if( rootNodes[ y ].model.id !== node.model.id ) {
                if( visibleEdges[ x ].model.leftId === rootNodes[ y ].model.id ) {
                    source.push( rootNodes[ y ].model.category );
                }

                if( visibleEdges[ x ].model.rightId === rootNodes[ y ].model.id ) {
                    target.push( rootNodes[ y ].model.category );
                }
            }
        }
    }

    if( counts.inDegrees.length > 0 || counts.outDegrees.length > 0 ) {
        _.forEach( legend.legendViews, function( view ) {
            if( view.internalName === legend.defaultActiveView ) {
                _.forEach( view.categoryTypes, function( type ) {
                    _.forEach( type.categories, function( category ) {
                        if( category.isFiltered === true ) {
                            for( let i = 0; i < counts.inDegrees.length; ++i ) {
                                let degree = counts.inDegrees[ i ];

                                if( type.internalName === 'relations' ) {
                                    if( category.internalName === degree[ 0 ] ) {
                                        counts.inDegrees.splice( i--, 1 );
                                    }
                                } else if( type.internalName === 'objects' ) {
                                    if( category.internalName === degree[ 1 ] ) {
                                        if( source.length > 0 && source[ 0 ] === category.internalName ) {
                                            source.pop();
                                        } else {
                                            counts.inDegrees.splice( i--, 1 );
                                        }
                                    }
                                }
                            }

                            for( let i = 0; i < counts.outDegrees.length; ++i ) {
                                let degree = counts.outDegrees[ i ];

                                if( type.internalName === 'relations' ) {
                                    if( category.internalName === degree[ 0 ] ) {
                                        counts.outDegrees.splice( i--, 1 );
                                    }
                                } else if( type.internalName === 'objects' ) {
                                    if( category.internalName === degree[ 1 ] ) {
                                        if( target.length > 0 && target[ 0 ] === category.internalName ) {
                                            target.pop();
                                        } else {
                                            counts.outDegrees.splice( i--, 1 );
                                        }
                                    }
                                }
                            }
                        }
                    } );
                } );
            }
        } );
    }

    return counts;
};

/**
 * resolveConnectedGraph
 */
export let resolveConnectedGraph = function( graphModel ) {
    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var graphNodes = graph.getNodes();

    var visibleNodes = graphModel.graphControl.graph.getVisibleNodes();
    var rootNodes = _.filter( visibleNodes, rootNodeFilter );

    if( rootNodes && rootNodes.length > 0 ) {
        var connectedGraphNodes = graphPathsService.getConnectedGraph( rootNodes, getNextLevelNodes );
        var orphanNodes = _.difference( graphNodes, connectedGraphNodes );

        if( orphanNodes && orphanNodes.length > 0 ) {
            graphModel.graphControl.graph.removeNodes( orphanNodes );
        }
    }
};

/**
 * updateRelationCounts
 */
export let updateRelationCounts = function( graphModel, legend ) {
    try {
        var graphControl = graphModel.graphControl;
        var graph = graphControl.graph;

        var nodes = graph.getNodes();
        var rootNodes = _.filter( nodes, rootNodeFilter );

        var visibleNodes = graph.getVisibleNodes();

        // Check each node and verify counts
        _.forEach( visibleNodes, function( node ) {
            var filteredEdgeCount = exports.getFilteredCounts( legend, rootNodes, node );

            // Update the binding data
            updateNodeBindingData( graph, node, filteredEdgeCount );
        } );
    } catch ( ex ) {
        logger.debug( ex );
    }
};

/**
 * updateNodeBindingData
 */
function updateNodeBindingData( graph, node, filteredEdgeCount ) {
    var bindData = {};

    var filteredInEdgeCount = filteredEdgeCount.inDegrees.length;
    var filteredOutEdgeCount = filteredEdgeCount.outDegrees.length;

    bindData.filtered_in_degree = filteredInEdgeCount.toString();
    bindData.filtered_out_degree = filteredOutEdgeCount.toString();

    var inEdges = node.getEdges( graphConstants.EdgeDirection.IN );
    var visibleInEdges = _.filter( inEdges, function( edge ) {
        return edge.isVisible();
    } );
    var visibleInEdgesCount = visibleInEdges.length;

    var outEdges = node.getEdges( graphConstants.EdgeDirection.OUT );
    var visibleOutEdges = _.filter( outEdges, function( edge ) {
        return edge.isVisible();
    } );
    var visibleOutEdgesCount = visibleOutEdges.length;

    bindData.visible_in_degree = visibleInEdgesCount.toString();
    bindData.visible_out_degree = visibleOutEdgesCount.toString();

    bindData.incoming_all_shown = false;
    bindData.incoming_show_expand_button = false;
    bindData.incoming_show_partial_expand_button = false;

    if( filteredInEdgeCount > 0 ) {
        if( visibleInEdgesCount > 0 ) {
            if( visibleInEdgesCount === filteredInEdgeCount ) {
                bindData.incoming_show_expand_button = true;
                bindData.incoming_all_shown = true;
            } else {
                bindData.incoming_show_partial_expand_button = true;
            }
        } else {
            bindData.incoming_show_expand_button = true;
        }
    }

    bindData.outgoing_all_shown = false;
    bindData.outgoing_show_expand_button = false;
    bindData.outgoing_show_partial_expand_button = false;

    if( filteredOutEdgeCount > 0 ) {
        if( visibleOutEdgesCount > 0 ) {
            if( visibleOutEdgesCount === filteredOutEdgeCount ) {
                bindData.outgoing_show_expand_button = true;
                bindData.outgoing_all_shown = true;
            } else {
                bindData.outgoing_show_partial_expand_button = true;
            }
        } else {
            bindData.outgoing_show_expand_button = true;
        }
    }

    graph.updateNodeBinding( node, bindData );
}

/**
 * Get the LDF Dialog utility service if installed
 *
 * @returns {Promise} Promise object
 */
let getLdfDialogUtilsService = function() {
    var deferred = AwPromiseService.instance.defer();
    //Get all of the command providers
    contributionService.loadContributions( 'ldfDialogUtilsService' ).then( function( providers ) {
        if( providers && providers[ 0 ] ) {
            providers[ 0 ].getLdfDialogUtilsService().then( function( depModuleObjIn ) {
                _awldfDialogUtilsService = depModuleObjIn;
                return deferred.resolve( _awldfDialogUtilsService );
            } );
        } else {
            _awldfDialogUtilsService = null;
            deferred.resolve( null );
        }
    } );

    return deferred.promise;
};

/**
 * Perform the task using LDF Dialog utility service
 *
 * @param {object} ctx - the current selection object
 * @param {object} data - the data Object
 * @param {object} eventdata - the event data
 *
 */
export let handleOauthRequestInternal = function( ctx, data, eventdata ) {
    if( _awldfDialogUtilsService ) {
        _awldfDialogUtilsService.handleExternalOauthRequest( ctx, data, eventdata );
    } else {
        var deferred = AwPromiseService.instance.defer();
        getLdfDialogUtilsService().then( function( _awldfDialogUtilsService ) {
            deferred.resolve( null );
            if( _awldfDialogUtilsService  ) {
                _awldfDialogUtilsService.handleExternalOauthRequest( ctx, data, eventdata );
            }
        } );
    }
};

export default exports = {
    getFilteredCounts,
    resolveConnectedGraph,
    updateRelationCounts,
    handleOauthRequestInternal
};
