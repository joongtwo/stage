// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Rv1RelationBrowserDrawEdge
 */
import graphStyleService from 'js/Rv1RelationBrowserGraphStyles';
import _ from 'lodash';
import logger from 'js/logger';
import graphLegendSvc from 'js/graphLegendService';

// A cache for the various style settings for edges, plain and when hovered over, for each different line
// type - TraceabilityStyle, WhereUsedStyle, etc.  See also updateEdgeStylesCache(),
var _EdgeStylesCache = { plain: {}, hovered: {} };

var exports = {};

/**
 * Update the service's cache for standard and hovered edge styles.
 * @param {Object} graphModel - The graph model object.
 * @param {Object} edgeStyle - The style appropriate for the particular style tag.  See also processEdgeData.
 */
function updateEdgeStylesCache( graphModel, edgeStyle ) {
    if( typeof  _EdgeStylesCache.plain[ edgeStyle.relationType ]  === 'undefined' || !_EdgeStylesCache.plain[ edgeStyle.relationType ] ) {
        _EdgeStylesCache.plain[ edgeStyle.relationType ] = _.clone( edgeStyle );
    }
    if( typeof  _EdgeStylesCache.hovered[ edgeStyle.relationType ]  === 'undefined' || !_EdgeStylesCache.hovered[ edgeStyle.relationType ] ) {
        _EdgeStylesCache.hovered[ edgeStyle.relationType ] = _.clone( edgeStyle );
        _EdgeStylesCache.hovered[ edgeStyle.relationType ].thickness *= graphModel.hoverStyle.edge.thicknessScale;
    }
}

/**
 * Process edges returned by server SOA
 * @param {Object} graphModel - The graph model object.
 * @param {Object} graphData - Graph data object
 * @param {Object} activeLegendView - currently active legend view
 * @param {Object} bIsConcentrated -preference for concentrated edges
 *
 * @return {Objec} processed graph edges
 */
export let processEdgeData = function( graphModel, graphData, activeLegendView, bIsConcentrated ) {
    var portMap = {};
    var addedEdges = [];
    var existingEdges = [];

    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var edges = graphData.edges;

    if( !graphModel.structureEdgeDatas ) {
        graphModel.structureEdgeDatas = [];
    }

    _.forEach( edges,
        function( edgeData ) {
            var edge;

            let sourceNodeModel = graphModel.dataModel.nodeModels[edgeData.leftId];
            let targetNodeModel = graphModel.dataModel.nodeModels[ edgeData.rightId ];
            var edgeObj = edgeData.metaObject;
            if( !sourceNodeModel && !targetNodeModel ) {
                // TODO should probably show user error message
                logger.error( 'Failed to get source or target node. Skip drawing the edge: ' + edgeData.leftId +
                    ' to ' + edgeData.rightId );
                return;
            }

            // Get the default edge style properties.
            var defaultEdgeStyle = graphModel.config.defaults.edgeStyle;

            // Get the edge style properties defined by the legend.
            var legendEdgeStyle = graphLegendSvc.getStyleFromLegend( 'relations', edgeData.relationType, activeLegendView );

            // Get the edge style properties from the user's preferences (GraphStyle.xml).
            var preferenceEdgeStyle = graphStyleService.getEdgeStyle( edgeData.props.StyleTag );

            // Merge the resulting styles in order of precendent.
            var edgeStyle = _.defaults( {}, preferenceEdgeStyle, legendEdgeStyle, defaultEdgeStyle );

            // Add types to style for later comparison checks
            edgeStyle.relationType = edgeData.relationType;
            edgeStyle.styleTag = edgeData.props.StyleTag;

            updateEdgeStylesCache( graphModel, edgeStyle );

            let sourceNode = sourceNodeModel.graphItem;
            let targetNode = targetNodeModel.graphItem;
            if( sourceNode && targetNode ) {
                var matchFound = false;

                // look for existing match
                try {
                    var sourceEdges = sourceNode.getEdges();
                    var targetEdges = targetNode.getEdges();

                    var allEdges = sourceEdges.concat( targetEdges );
                    allEdges = _.uniq( allEdges );

                    _.forEach( allEdges, function( tmpEdge ) {
                        var edgeSourceNodeObj = tmpEdge.getSourceNode().model.nodeObject;
                        var edgeTargetNodeObj = tmpEdge.getTargetNode().model.nodeObject;

                        if( sourceNodeModel.nodeObject === edgeSourceNodeObj &&
                            targetNodeModel.nodeObject === edgeTargetNodeObj &&
                            edgeStyle.relationType === tmpEdge.style.relationType &&
                            edgeObj.uid === tmpEdge.model.edgeObject.uid ) {
                            matchFound = true;

                            existingEdges.push( tmpEdge );

                            return false;
                        }
                    } );
                } catch ( e ) {
                    logger.error( e );
                }

                // only add edge if match not found
                if( !matchFound ) {
                    try {
                        if( !bIsConcentrated ) {
                            // Create an edge between the source and target nodes.
                            edge = graph.createEdgeWithNodesStyleAndTag( sourceNode, targetNode, edgeStyle, null );
                        } else {
                            // We create two port "keys" representing the group this edge belongs to on the source and target node.
                            // We map from {modelObjectUID,relation,direction}->port in order to ensure there is only ever one port per node,
                            // relation type and direction. If we were the first to identify this port key, we will create the port and store
                            // it so later relations can "attach" themselves to it.
                            var portKeySource = sourceNodeModel.nodeObject.uid + ':' + edgeData.relationType + ':Source';
                            var portKeyTarget = targetNodeModel.nodeObject.uid + ':' + edgeData.relationType + ':Target';

                            if( !portMap[ portKeySource ] ) {
                                portMap[ portKeySource ] = graph.addPortAtLocationWithStyle( sourceNode, undefined, graphModel.config.defaults.portStyle );

                                // Add an outgoing port from the source node...
                                //portMap[portKeySource] = addOutgoingPort( graph, sourceNode );
                            }

                            if( !portMap[ portKeyTarget ] ) {
                                portMap[ portKeyTarget ] = graph.addPortAtLocationWithStyle( targetNode, undefined, graphModel.config.defaults.portStyle );

                                // to an incoming port on the target node.
                                //portMap[portKeyTarget] = addIncomingPort( graph, targetNode );
                            }

                            // Create an edge between the source and target ports.
                            edge = graph.createEdgeWithPortsStyleAndTag( portMap[ portKeySource ], portMap[ portKeyTarget ], edgeStyle, null );
                        }

                        if( edgeData.edgePosition ) {
                            graph.setEdgePosition( edge, edgeData.edgePosition );
                        }

                        sourceNode.isOutGoingExpanded = true;
                        targetNode.isInComingExpanded = true;
                    } catch ( e ) {
                        logger.error( e );
                    }
                }
            }

            if( edge ) {
                var legendCategory = graphLegendSvc.getLegendCategory(
                    'relations', edgeData.relationType, activeLegendView, false );
                var edgeLabel = legendCategory && legendCategory.displayName ?
                    legendCategory.displayName : edgeData.relationType;
                graph.setLabel( edge, edgeLabel );
                edge.category = edgeData.relationType;

                let edgeModel = {
                    edgeObject: edgeData.metaObject,
                    leftId: edgeData.leftId,
                    rightId: edgeData.rightId
                };

                // record all added edges
                addedEdges.push( edge );

                // dont push edgeModel unless we want to maintain them
                // graphModel.addEdgeModel( edge, edgeModel );
                edge.model = edgeModel;
            }
        }
    );

    return { addedEdges: addedEdges, existingEdges: existingEdges };
};

/*

(e1bwzy) Leave the following code untouched please!
I have reported it as a potential bug with GC/SDF and would like to keep it around for testing

var addIncomingPort = function( graph, node ) {

    if ( !graph || !node ) {
        return null;
    }

    var port = new window.SDF.Models.Port( graph._sheet, 0, 0, null, null, null, node );
    port.setParentSides( window.SDF.Utils.AllowedSides.TOP );
    node.addPort( window.SDF.Utils.Direction.IN, port );

    return port;
};

var addOutgoingPort = function( graph, node ) {

    if ( !graph || !node ) {
        return null;
    }

    var port = new window.SDF.Models.Port( graph._sheet, 0, 0, null, null, null, node );
    port.setParentSides( window.SDF.Utils.AllowedSides.BOTTOM );
    node.addPort( window.SDF.Utils.Direction.OUT, port );

    return port;
};
*/

/**
 * Set the style for an edge.  If the edge is being hovered over, use the style
 * in the style cache for hover, else use the plain styling cache.
 *
 * @param {Object} graphModel - The graph model object.
 * @param {Object} edge - The edge on which to set the style.
 * @param {String} isHovered - true if the node is being hovered over.
 */
export let setEdgeStyle = function( graphModel, edge, isHovered ) {
    if( !graphModel || !edge ) {
        return;
    }

    if( isHovered && typeof  _EdgeStylesCache.hovered[ edge.style.relationType ]  !== 'undefined' ) {
        graphModel.graphControl.graph.setEdgeStyle( edge, _EdgeStylesCache.hovered[ edge.style.relationType ] );
    } else if( typeof  _EdgeStylesCache.plain[ edge.style.relationType ]  !== 'undefined' ) {
        graphModel.graphControl.graph.setEdgeStyle( edge, _EdgeStylesCache.plain[ edge.style.relationType ] );
    }
};

/**
 * Rv1RelationBrowserDrawEdge factory
 */

export default exports = {
    processEdgeData,
    setEdgeStyle
};
