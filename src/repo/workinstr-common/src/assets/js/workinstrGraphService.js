// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * This service helps create the graph data to be displayed and also saves it.
 *
 * @module js/workinstrGraphService
 */
import eventBus from 'js/eventBus';

/**
 * map where the object is key and graphNode is value
 */
let nodesMap = new Object();

/**
 * an array of graph nodes
 */
let myGraphNodes = [];

/**
 * an array of graph edges
 */
let myGraphEdges = [];

/**
 * the emtpy node rectangle style
 */
const EMPTY_NODE_RECT_STYLE = {};

/**
 * bindable graph properties that are being used in the graph html template
 */
export const bindableProperties = {
    NODE_ID_PROP: 'node_id',
    IMAGE_PROP: 'thumbnailURL',
    NODE_TITLE_PROP: 'node_title',
    NODE_PROPERTY_PROP: 'node_property',
    NODE_SECOND_PROPERTY_PROP: 'node_second_property',
    NODE_STROKE_WIDTH_PROP: 'node_stroke_width',
    NODE_ICON_WIDTH: 'node_icon_width',
    NODE_ICON_HEIGHT: 'node_icon_height',
    NODE_ICON_TRANSFORM: 'node_icon_transform'
};

/**
 * The draw graph method which creates nodes and edges
 *
 * @param {Object} graphModel the graph model object
 * @param {ObjectArray} nodesArray the nodes list to be added to the graph
 * @param {ObjectArray} edgesArray the edges list to be added to the graph
 */
export function drawGraph( graphModel, nodesArray, edgesArray ) {
    if( !graphModel.graphControl || graphModel.graphControl === undefined ) {
        return;
    }

    const graphControl = graphModel.graphControl;
    const graph = graphControl.graph;
    resetGraphData( graph );

    // Create all nodes in the graph
    nodesArray.forEach( ( nodeObject ) => {
        const graphNode = graph.createNodeWithBoundsStyleAndTag( EMPTY_NODE_RECT_STYLE, null, nodeObject.bindData );
        myGraphNodes.push( graphNode );
        nodesMap[ nodeObject.nodeObject ] = graphNode;
    } );

    // Create all edges in the graph
    edgesArray.forEach( ( edge ) => {
        const graphEdge = graph.createEdgeWithNodesStyleAndTag( findNodeRepresentingGivenObject( edge.source ),
            findNodeRepresentingGivenObject( edge.target ), null, null );
        myGraphEdges.push( graphEdge );
    } );

    graphControl.layout.applyLayout();
    graphControl.fitGraph();
    eventBus.publish( 'workinstrGraph.loaded' );
}

/**
 * This method applies the layout of the given graph located in the graphModel
 *
 * @param {Object} graphModel - the graph model
 * @param {String} layoutType - snake, hierarchy, balloon and etc.
 * @param {String} layoutDirection - from LeftToRight, TopToBottom and etc
 */
export function applyLayout( graphModel, layoutType, layoutDirection ) {
    const graphControl = graphModel.graphControl;
    if( layoutType ) {
        graphControl.layout.setLayoutType( layoutType );
    }
    if( layoutDirection ) {
        graphControl.layout.setLayoutDirection( layoutDirection );
    }
    graphControl.layout.applyLayout();
    graphControl.fitGraph();
}

/**
 * This method removes the current edges and replaces them with the new given edges
 *
 * @param {Object} graphModel - the graph model
 * @param {ObjectArray} listOfNewEdges - list of new edges to add to the graph model
 */
export function replaceOldEdgesWithNewEdges( graphModel, listOfNewEdges ) {
    let graph = graphModel.graphControl.graph;
    graph.removeEdges( myGraphEdges );

    myGraphEdges = [];

    listOfNewEdges.forEach( ( newEdge ) => {
        const graphEdge = graph.createEdgeWithNodesStyleAndTag( findNodeRepresentingGivenObject( newEdge.source ),
            findNodeRepresentingGivenObject( newEdge.target ), null, null );
        myGraphEdges.push( graphEdge );
    } );
}

/**
 * Creates an edge in JSON format
 *
 * @param {Object} sourceObject - the edge source object
 * @param {Object} targetObject - the edge target object
 *
 * @return {Object} the created edge
 */
export function createEdgeJson( sourceObject, targetObject ) {
    if( sourceObject && targetObject ) {
        return {
            source: sourceObject,
            target: targetObject
        };
    }
    return null;
}

/**
 * This method creates a node in JSON format.
 *
 * @param {Object} object - the object represented by the node
 * @param {Object} bindableData - the bindable data that is saved based on the properties of the graph template html
 *
 * @return {Object} the created node
 */
export function createNodeJson( object, bindableData ) {
    if( object ) {
        return {
            nodeObject: object,
            bindData: bindableData
        };
    }
    return null;
}

/**
 * This method returns the data id of a given node. The data id value is binded when the node is created
 *
 * @param {Object} nodeItem - the given graph node item
 *
 * @return {String} the node uid
 */
export function getDataUidFromGivenNode( nodeItem ) {
    if( nodeItem ) {
        return nodeItem.getProperty( bindableProperties.NODE_ID_PROP );
    }
    return null;
}

/**
 * Find node by the given object
 *
 * @param {Object} object - a given object
 *
 * @return {Object} the node which represents the object
 */
function findNodeRepresentingGivenObject( object ) {
    return nodesMap[ object ];
}

/**
 * Resets the graph data given the graph object
 *
 * @param {Object} graphObject - the graph object
 */
function resetGraphData( graphObject ) {
    if( myGraphNodes.length > 1 ) {
        graphObject.clear();
    }
    myGraphNodes = [];
    myGraphEdges = [];
    nodesMap = new Object();
}


export default {
    bindableProperties,
    drawGraph,
    applyLayout,
    replaceOldEdgesWithNewEdges,
    createEdgeJson,
    createNodeJson,
    getDataUidFromGivenNode
};
