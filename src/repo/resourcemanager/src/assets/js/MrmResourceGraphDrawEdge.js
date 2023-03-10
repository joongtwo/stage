// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/MrmResourceGraphDrawEdge
 */
import graphStyleService from 'js/Rv1RelationBrowserGraphStyles';
import _ from 'lodash';
import logger from 'js/logger';
import graphLegendSvc from 'js/graphLegendService';

// A cache for the various style settings for edges, plain and when hovered over, for each different line
// type - TraceabilityStyle, WhereUsedStyle, etc.  See also updateEdgeStylesCache(),
var _EdgeStylesCache = { plain: {}, hovered: {} };

var exports = {};
var BreakException = {};

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
 *
 * @param {Object} graphModel - The graph model object.
 * @param {Object} graphData -
 * @param {Object} activeLegendView -
 */
export let processEdgeData = function( graphModel, graphData, activeLegendView, bIsConcentrated ) {
    var portMap = {};
    var addedEdges = [];
    var existingEdges = [];

    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var groupGraph = graphControl.groupGraph;
    var edges = graphData.edges;
    if( !graphModel.structureEdgeDatas ) {
        graphModel.structureEdgeDatas = [];
    }

    _.forEach( edges,
        function( edgeData ) {
            var edge;
            var needToAddEdge = true;
            var sourceNode = graphModel.nodeMap[ edgeData.startNodeId ];
            var targetNode = graphModel.nodeMap[ edgeData.endNodeId ];
            if( !sourceNode && !targetNode ) {
                logger.error( 'Failed to get source or target node. Skip drawing the edge: ' + edgeData.startNodeId +
                    ' to ' + edgeData.endNodeId );
                return;
            }

            // Get the default edge style properties.
            var defaultEdgeStyle = graphModel.config.defaults.edgeStyle;

            // Get the edge style properties defined by the legend.
            var legendEdgeStyle = graphLegendSvc.getStyleFromLegend( 'relations', 'Attach', activeLegendView );

            // Get the edge style properties from the user's preferences (GraphStyle.xml).
            var preferenceEdgeStyle = graphStyleService.getEdgeStyle( 'AttachStyle' );

            // Merge the resulting styles in order of precedent.
            var edgeStyle = _.defaults( {}, preferenceEdgeStyle, legendEdgeStyle, defaultEdgeStyle );

            // Add types to style for later comparison checks
            edgeStyle.relationType = 'Attach';
            edgeStyle.styleTag = 'AttachStyle';

            updateEdgeStylesCache( graphModel, edgeStyle );

            if( sourceNode && targetNode ) {
                var parentNodeOfTargetNode = graphModel.nodeMap[ targetNode.appData.nodeObject.props.awb0Parent.dbValues[ 0 ] ];
                if( groupGraph.isGroup( parentNodeOfTargetNode ) ) {
                    groupGraph.setParent( parentNodeOfTargetNode, [ targetNode ] );
                    if( sourceNode.appData.nodeObject.uid === parentNodeOfTargetNode.appData.nodeObject.uid ) {
                        needToAddEdge = false;
                    }
                }

                if( needToAddEdge ) {
                    var matchFound = false;

                    // look for existing match
                    try {
                        var sourceEdges = sourceNode.getEdges();
                        var targetEdges = targetNode.getEdges();

                        var allEdges = sourceEdges.concat( targetEdges );
                        allEdges = _.uniq( allEdges );

                        _.forEach( allEdges, function( tmpEdge ) {
                            var edgeSourceNodeObj = tmpEdge.getSourceNode().appData.nodeObject;
                            var edgeTargetNodeObj = tmpEdge.getTargetNode().appData.nodeObject;

                            if( sourceNode.appData.nodeObject === edgeSourceNodeObj &&
                                targetNode.appData.nodeObject === edgeTargetNodeObj &&
                                edgeStyle.relationType === tmpEdge.style.relationType ) {
                                matchFound = true;

                                existingEdges.push( tmpEdge );

                                throw BreakException;
                            }
                        } );
                    } catch ( e ) {
                        if( e !== BreakException ) { logger.error( e ); }
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
                                var portKeySource = sourceNode.appData.nodeObject.uid + ':' + edgeData.relationType + ':Source';
                                var portKeyTarget = targetNode.appData.nodeObject.uid + ':' + edgeData.relationType + ':Target';

                                if( !portMap[ portKeySource ] ) {
                                    portMap[ portKeySource ] = graph.addPortAtLocationWithStyle( sourceNode, undefined, graphModel.config.defaults.portStyle );
                                }

                                if( !portMap[ portKeyTarget ] ) {
                                    portMap[ portKeyTarget ] = graph.addPortAtLocationWithStyle( targetNode, undefined, graphModel.config.defaults.portStyle );
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
            }

            if( edge ) {
                graph.setLabel( edge, 'Attach' );
                edge.category = 'Attach';
                // record all added edges
                addedEdges.push( edge );
            }
        }
    );

    return { addedEdges: addedEdges, existingEdges: existingEdges };
};

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

export default exports = {
    processEdgeData,
    setEdgeStyle
};
