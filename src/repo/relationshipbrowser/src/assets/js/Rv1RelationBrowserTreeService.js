// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */
/**
 * This module defines tree structure, used for SortedLayout
 *
 * @module js/Rv1RelationBrowserTreeService
 */
import _ from 'lodash';
import graphConstants from 'js/graphConstants';

'use strict';

var exports = {};

var id = function( node ) {
    if( !node || !node.model ) {
        throw 'invalid node pass in!';
    }
    return node.model.nodeObject.uid;
};

var TreeItem = function( hostNode, childItems ) {
    this.hostNode = hostNode;
    this.childItems = childItems || [];
    this.ownEdges = [];
};

TreeItem.prototype.addChild = function( childItem ) {
    if( this.childItems && this.childItems.indexOf( childItem ) >= 0 ) {
        return;
    }
    this.childItems.push( childItem );
};

TreeItem.prototype.hasChild = function() {
    return this.childItems && this.childItems.length > 0;
};

TreeItem.prototype.hasOwnEdge = function() {
    return this.ownEdges && this.ownEdges.length > 0;
};

TreeItem.prototype.addOwnEdge = function( edge ) {
    if( this.ownEdges && this.ownEdges.indexOf( edge ) >= 0 ) {
        return false;
    }
    this.ownEdges.push( edge );
    return true;
};

var getTreeItem = function( map, node ) {
    var _id = id( node );

    var item = map[ _id ];
    if( !item ) {
        map[ _id ] = new TreeItem( node );
    }

    return map[ _id ];
};

var hoistOwnEdgesToRootNode = function hoistOwnEdgesToRootNode( rootNodeTree, currentNodeTree ) {
    if( !rootNodeTree || !rootNodeTree.hasChild() || !currentNodeTree || !currentNodeTree.hasChild() ) {
        return;
    }

    _.each( currentNodeTree.childItems, function( item ) {
        var processChildren = false;

        if( item.hasOwnEdge() ) {
            _.each( item.ownEdges, function( edge ) {
                var updated = rootNodeTree.addOwnEdge( edge );

                if( updated ) {
                    processChildren = true;
                }
            } );
        }

        if( processChildren ) {
            hoistOwnEdgesToRootNode( rootNodeTree, item );
        }
    } );
};

/**
 * buildNodeTree utils for SortedLayout usage.
 *
 * @param edges the added edges
 * @param direction the expand direction
 * @param seedNode the node that was expanded
 */
export let buildNodeTree = function( edges, direction, seedNode ) {
    if( !direction || !seedNode ) {
        return;
    }

    var nodeTree = new TreeItem( seedNode );
    var seedId = id( seedNode );

    var nodeTreeItemMap = {};
    nodeTreeItemMap[ seedId ] = nodeTree;

    //for each edge
    _.each( edges, function( edgeData ) {
        var sourceNode = edgeData.getSourceNode();
        var targetNode = edgeData.getTargetNode();

        var parent = getTreeItem( nodeTreeItemMap, sourceNode );
        var child = getTreeItem( nodeTreeItemMap, targetNode );

        if( direction === graphConstants.ExpandDirection.BACKWARD ) {
            child.addChild( parent );
            child.addOwnEdge( edgeData );
        } else if( direction === graphConstants.ExpandDirection.FORWARD ) {
            parent.addChild( child );
            parent.addOwnEdge( edgeData );
        }
    } );

    hoistOwnEdgesToRootNode( nodeTree, nodeTree );
    return nodeTree;
};

export default exports = {
    buildNodeTree
};
