//@<COPYRIGHT>@
//==================================================
//Copyright 2021.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 */

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Rv1RelationBrowserSelectionService
 */
import drawEdgeService from 'js/Rv1RelationBrowserDrawEdge';
import _ from 'lodash';
import logger from 'js/logger';
import graphPaths from 'js/graphPathsService';

var NODE_HOVERED_CLASS = 'relation_node_hovered_style_svg';
var TEXT_HOVERED_CLASS = 'relation_text_hovered_style_svg';
var NODE_DEFAULT_CLASS = 'aw-graph-noeditable-area';

var _firstSelectedNode = null; // This is to maintain the first selected node to support finding the path between two selected nodes.  See graphMultiSelect() below.
var _previouslySelectedItems = []; // This is to support the selection algorithm in graphSelectionChanged() below.  It holds the items in the selected state the previous time graphSelectionChanged() was called.

/** -------------------------------------------------------------------
 * Keep track of the first node selected.  It is used for helping with the
 * behavior of shift-click path selection, etc.
 *
 * @param {Object} graphModel - The graph model object.
 */
function setFirstSelection( graphModel ) {
    var selectedNodes = graphModel.graphControl.getSelected( 'Node' );
    if( selectedNodes.length === 0 ) {
        _firstSelectedNode = null;
    } else if( selectedNodes.length === 1 ) {
        _firstSelectedNode = selectedNodes[ 0 ];
    }
}

/** -------------------------------------------------------------------
 * Return the model object for the given edge.  Note that not all edges have associated model objects.
 * @see processEdgeData() of Rv1RelationBrowserDrawEdge.js
 *
 * @param {Object} edge - The selected edge object.
 * @return {Object} The edge's model object (null if there is no associated model object).
 */
function getEdgeModelObject( edge ) {
    if( !edge.model || !edge.model.edgeObject ||
        edge.model.edgeObject.objectID === '' || edge.model.edgeObject.type === 'unknownType' ) {
        return null;
    }
    return edge.model.edgeObject;
}

/** -------------------------------------------------------------------
 * Update the AW selection service so it knows about the element(s) selected.
 * The AW selection service keeps the model object so it can be used elsewhere
 * to show data from the selected object, such as in the info panel.
 * Only a single element is supported at this time.  If nothing is
 * selected, the root node of the graph is used.
 *
 * @param {Object} selectedItems The list of nodes and edges currently selected in the graph
 * @param {Object} selectionData selection data from parent component
 */
function updateAWSelectionService( selectedItems, selectionData ) {
    var selectedModelObjs = [];
    _.forEach( selectedItems, function( selectedObject ) {
        if( selectedObject.getItemType() === 'Node' ) {
            if( !selectedModelObjs.includes( selectedObject.model.nodeObject ) ) {
                selectedModelObjs.push( selectedObject.model.nodeObject );
            }
        } else {
            var edgeObj = getEdgeModelObject( selectedObject );
            if( edgeObj && !selectedModelObjs.includes( edgeObj ) ) {
                selectedModelObjs.push( edgeObj );
            }
        }
    } );
    selectionData.update( { selected: selectedModelObjs } );
}

/** -------------------------------------------------------------------
 * Handle the awGraph.selectionChanged event.
 *
 * @param {Object} graphModel graph model object
 * @param {Object} eventData data pertinent to the selectionChanged event.  @see setSelected() in graphControlFactory.js
 * @param {Object} selectionData selection data from parent component
 * @return {Object} Selected nodes and edges
 */
export let graphSelectionChanged = function( graphModel, eventData, selectionData ) {
    let selectionStateValue = {
        nodes: [],
        edges: []
    };
    try {
        var currentSelectedNodes = graphModel.graphControl.getSelected( 'Node' );
        var currentSelectedEdges = graphModel.graphControl.getSelected( 'Edge' );
        var selectedItems = _.concat( currentSelectedNodes, currentSelectedEdges );
        selectionStateValue.nodes = selectionStateValue.nodes.concat( currentSelectedNodes );
        selectionStateValue.edges = selectionStateValue.edges.concat( currentSelectedEdges );

        graphModel.numSelected = selectedItems.length;

        // Unset the hover style from all nodes and edges that are, or were, selected.  Otherwise, nodes that get
        // unselected could still have the hover style.
        setHoverStyles( graphModel, _.union( selectedItems, eventData.unSelected ), false );

        setFirstSelection( graphModel );
        updateAWSelectionService( selectedItems, selectionData );

        // Handle edges: Highlighting their source and target nodes.
        // --
        // --!! The selected state returned by getSelected() appears to be accurate and includes all newly selected items and excludes
        // --!! all newly unselected items present in eventData.
        // Don't do any programmatic selection or unselection of edges - only src and target nodes.
        // 1) Based on edges currently selected, determine if there are any more nodes that should be highlighted, and highlight those.
        // 2) Based on edges newly unselected, determine if there are any more nodes that should not be highlighted.
        // Set the edge style (sets to hovered) for all selected edges.  Unset this style for all newly unselected edges.
        // The lists from 1) and 2) may contain more than needed.  E.g., don't remove nodes if they are also listed in the nodes-to-be-added.
        // + There is one special case.  After a single edge and its nodes are selected, clicking one of the already selected nodes should
        //   result in only that node being selected.  stillSelectedNodes below helps resolve this.  Otherwise, it might be necessary to
        //   have reference counting on nodes connected to multiple edges to know whether they should be turned off or on.

        var unSelectedItems = _.filter( eventData.unSelected, function( o ) {
            return typeof o.model !== 'undefined';
        } );

        var newlyUnselectedItems = _.partition( unSelectedItems, function( o ) { return typeof o.model.edgeObject !== 'undefined'; } );
        var newlyUnselectedEdges = newlyUnselectedItems[ 0 ];
        var newlyUnselectedNodes = newlyUnselectedItems[ 1 ];

        var addTheseNodes = [];
        if( currentSelectedEdges.length > 0 ) {
            for( var idx = 0; idx < currentSelectedEdges.length; idx++ ) {
                drawEdgeService.setEdgeStyle( graphModel, currentSelectedEdges[ idx ], true ); // Just the edge style.  _Node_ selected-style is set via binding in the HTML
                addTheseNodes.push( currentSelectedEdges[ idx ].getSourceNode(), currentSelectedEdges[ idx ].getTargetNode() );
            }
            addTheseNodes = _.uniq( addTheseNodes );
        }
        var removeTheseNodes = [];
        if( newlyUnselectedEdges.length > 0 ) {
            for( var jdx = 0; jdx < newlyUnselectedEdges.length; jdx++ ) {
                drawEdgeService.setEdgeStyle( graphModel, newlyUnselectedEdges[ jdx ], false ); // Just the edge style.  _Node_ selected-style is set via binding in the HTML
                removeTheseNodes.push( newlyUnselectedEdges[ jdx ].getSourceNode(), newlyUnselectedEdges[ jdx ].getTargetNode() );
            }
            removeTheseNodes = _.uniq( removeTheseNodes );
        }

        var stillSelectedNodes = _.intersection( _previouslySelectedItems, currentSelectedNodes );

        _.pullAll( removeTheseNodes, addTheseNodes ); // Pull out nodes that should still be selected because they have a selected edge still connecting them.
        _.pullAll( removeTheseNodes, newlyUnselectedNodes ); // Pull out nodes that are already unselected in the graph.
        if( stillSelectedNodes.length === 1 ) {
            _.pullAll( removeTheseNodes, stillSelectedNodes ); // See explanation above (+).
        }
        _.pullAll( addTheseNodes, currentSelectedNodes ); // Pull out nodes that are already selected in the graph.

        if( removeTheseNodes.length > 0 ) {
            setNodeHoverStyle( graphModel, removeTheseNodes, false );
        }
        if( addTheseNodes.length ) {
            setNodeHoverStyle( graphModel, addTheseNodes, true );
        }

        _previouslySelectedItems = selectedItems;
    } catch ( ex ) {
        logger.error( ex );
    }

    return selectionStateValue;
};

/** -------------------------------------------------------------------
 * Find and select all nodes in the paths through the graph from one node to another, parent to child.
 * @param {Object} graphModel Graph Model
 * @param {Object} selectedElements selected elements
 * @param {Object} firstNode first node
 * @param {Object} lastNode last node
 */
function graphFindPath( graphModel, selectedElements, firstNode, lastNode ) {
    // Set the unhovered style on all selected elements and then unselect all.
    setHoverStyles( graphModel, selectedElements, false );
    graphModel.graphControl.setSelected( null, false );

    // Passing null in getPaths to use the default supplied "getNextLevelEdges" method.  It
    // only traces through outbound edges, so since the order of the selected nodes depends
    // on the order of selection, one way may fail, in which case we try the other order.
    // The return value is an array of path arrays.  No need to process if we're only working
    // with a node and its child.
    var paths = graphPaths.getPaths( firstNode, lastNode, null );
    if( !paths || paths.length === 0 ) {
        paths = graphPaths.getPaths( lastNode, firstNode, null );
    }
    var allNodesInPath = [];
    if( paths ) {
        for( var i = 0; i < paths.length; ++i ) {
            var nodeList = paths[ i ].filter( function( elm ) { return typeof elm.getItemType === 'function' && elm.getItemType() === 'Node'; } );
            allNodesInPath = _.union( allNodesInPath, nodeList );
        }
    }
    if( allNodesInPath.length > 1 ) {
        graphModel.graphControl.setSelected( allNodesInPath, true );
    } else {
        graphModel.graphControl.setSelected( [ firstNode ], true );
    }
}

/** -------------------------------------------------------------------
 * Handle multi-selection, both for shift and cntrl keys down.  Ctrl key multi-select
 * is handled by the graphSelectionChanged, so here, just weed it out for shift select find-all-in-path behavior.
 *
 * @param {Object} graphModel graph model object
 * @param {Object} eventData data pertinent to the event
 * @param {Boolean} hasAdvancedLicense True if user has license, false otherwise
 * @param {Object} selectionData selection data from parent component
 */
export let graphMultiSelect = function( graphModel, eventData, hasAdvancedLicense, selectionData ) {
    if( !graphModel || !eventData || !eventData.isShiftKeyDown ) {
        return;
    }
    try {
        var selectedElements = graphModel.graphControl.getSelected();
        var selectedNodes = selectedElements.filter( function( elem ) { return elem.getItemType() === 'Node'; } );
        var selectectObjectsList = [];
        if( selectedElements && selectedElements.length > 1 ) {
            _.each( selectedElements, function( selectedElement ) {
                selectectObjectsList.push( selectedElement.model.nodeObject );
            } );
        }

        if( hasAdvancedLicense && _firstSelectedNode && selectedNodes && selectedNodes.length >= 2 ) {
            var lastNode = selectedNodes[ selectedNodes.length - 1 ];
            graphFindPath( graphModel, selectedElements, _firstSelectedNode, lastNode );
        }
        if( selectectObjectsList.length > 1 ) {
            selectionData.update( { selected: selectectObjectsList } );
        }
    } catch ( ex ) {
        logger.debug( ex );
    }
};

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
    var nodes = [];
    if( isHovered ) {
        nodes.push( edge.getSourceNode() );
        nodes.push( edge.getTargetNode() );
    } else {
        // do not un-hover nodes if any of their edges is in (multi)selection
        if( !isNodeEdgeSelected( graphModel, edge.getSourceNode() ) ) {
            nodes.push( edge.getSourceNode() );
        }
        if( !isNodeEdgeSelected( graphModel, edge.getTargetNode() ) ) {
            nodes.push( edge.getTargetNode() );
        }
    }
    if( nodes.length ) {
        setNodeHoverStyle( graphModel, nodes, isHovered );
    }
}

/** -------------------------------------------------------------------
 * Checks if any of the edges for the node are selected
 *
 * @param {Object} graphModel - The graph model object.
 * @param {Object} node - The array of nodes and edges on which to set the style.
 * @return {boolean} true if any of the edge is selected
 */
function isNodeEdgeSelected( graphModel, node ) {
    var selectedElements = graphModel.graphControl.getSelected();
    for( var i = 0; selectedElements && i < selectedElements.length; ++i ) {
        if( selectedElements[ i ].getItemType() === 'Edge' &&
            ( selectedElements[ i ].getSourceNode() === node ||
                selectedElements[ i ].getTargetNode() === node ) ) {
            return true;
        }
    }
    return false;
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

/** -------------------------------------------------------------------
 * Graph hover-changed handler
 *
 * @param {Object} graphModel - the graph model object
 * @param {Object} eventData - contains the hovered and/or unhovered items from the graph
 */
export let graphHoverChanged = function( graphModel, eventData ) {
    try {
        if( !graphModel || !eventData ) {
            return;
        }
        var unHoveredItem = eventData.unHoveredItem;
        var hoveredItem = eventData.hoveredItem;

        if( unHoveredItem && !unHoveredItem.isSelected() ) {
            if( unHoveredItem.getItemType() === 'Edge' ) {
                setEdgeHoverStyle( graphModel, unHoveredItem, false );
            } else if( unHoveredItem.getItemType() === 'Node' &&
                !isNodeEdgeSelected( graphModel, unHoveredItem ) ) {
                // do not un-hover nodes of selected edges
                setNodeHoverStyle( graphModel, [ unHoveredItem ], false );
            }
        }
        if( hoveredItem && !hoveredItem.isSelected() ) {
            if( hoveredItem.getItemType() === 'Edge' ) {
                setEdgeHoverStyle( graphModel, hoveredItem, true );
            } else if( hoveredItem.getItemType() === 'Node' ) {
                setNodeHoverStyle( graphModel, [ hoveredItem ], true );
            }
        }
    } catch ( ex ) {
        logger.debug( ex );
    }
};

const exports = {
    graphSelectionChanged,
    graphMultiSelect,
    graphHoverChanged
};
export default exports;
