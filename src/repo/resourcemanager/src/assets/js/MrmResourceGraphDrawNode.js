// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/MrmResourceGraphDrawNode
 */
import graphStyleService from 'js/Rv1RelationBrowserGraphStyles';
import _ from 'lodash';
import declUtils from 'js/declUtils';
import logger from 'js/logger';
import graphLegendSvc from 'js/graphLegendService';
import templateService from 'js/MrmResourceGraphTemplateService';
import appCtxService from 'js/appCtxService';

var MIN_NODE_SIZE = [ 300, 135 ];

var exports = {};

export let processNodeData = function( graphModel, graphData, activeLegendView ) {
    var addedNodes = [];

    var graphControl = graphModel.graphControl;
    var graph = graphControl.graph;
    var groupGraph = graphControl.groupGraph;
    var nodes = graphData.childNodes;
    var rootNodeIdOfCurrentLoadedData = graphData.parentNode.resourceOccurrenceId;

    var nodeRect = {
        width: 300,
        height: 135,
        x: 200,
        y: 200
    };

    _.forEach( nodes, function( nodeData ) {
        var nodeObject = nodeData;
        if( !graphModel.nodeMap[ nodeData.uid ] ) {
            if( rootNodeIdOfCurrentLoadedData !== nodeData.uid ) {
                var isRoot = false;
                var nodeCategory = 'File';
                var isGroupNode = false;
                var props = templateService.getBindPropertyNames( nodeObject );
                var bindData = templateService.getBindProperties( nodeObject, isRoot ); // Get the default node style 
                var flag = false;

                bindData.show_mrmtogglechildren_command = false;
                var numberOfChild = Number( nodeObject.props.awb0NumberOfChildren.dbValues[ 0 ] );
                if( numberOfChild > 0 ) {
                    bindData.show_mrmtogglechildren_command = true;
                    bindData.child_count = numberOfChild;
                    isGroupNode = true;
                    nodeCategory = 'Simulation';
                }

                var template = templateService.getNodeTemplate( graphModel.nodeTemplates, props, bindData.show_mrmtogglechildren_command, flag );

                if( !template ) {
                    logger.error( 'Failed to get SVG template for node object. Skip drawing the node. Object UID: ' + nodeObject.uid );
                    return;
                }

                var defaultNodeStyle = graphModel.config.defaults.nodeStyle; // Get the node style properties defined by the legend.

                var legendNodeStyle = graphLegendSvc.getStyleFromLegend( 'objects', nodeCategory, activeLegendView ); // Get the node style properties from the user's preferences (GraphStyle.xml).            

                var preferenceNodeStyle = graphStyleService.getNodeStyle( 'AttachStyle' ); // Merge the resulting styles in order of precedent.            

                var nodeStyle = _.defaults( {}, preferenceNodeStyle, legendNodeStyle, defaultNodeStyle );

                if( nodeStyle ) {
                    bindData.node_fill_color = nodeStyle.borderColor;
                } //fill node command binding data

                if( nodeObject.props.MRMPSP ) {
                    var topNodeUID = appCtxService.ctx.occmgmtContext.topElement.uid;
                    if( topNodeUID === nodeObject.props.awb0Parent.dbValues[0] ) {
                        bindData.show_psp_image = true;
                    } else {
                        bindData.show_subassembly_psp_image = true;
                    }
                }

                if( graphModel.nodeCommandBindData ) {
                    declUtils.consolidateObjects( bindData, graphModel.nodeCommandBindData );
                }

                if( nodeData.position ) {
                    nodeRect = nodeData.position;
                }

                var node = graph.createNodeWithBoundsStyleAndTag( nodeRect, template, bindData );
                node.setMinNodeSize( MIN_NODE_SIZE );
                node.appData = {
                    id: nodeData.uid,
                    nodeObject: nodeObject,
                    isGroup: isGroupNode,
                    inDegrees: '1',
                    outDegrees: '0',
                    category: nodeCategory
                }; // record all added nodes          
                addedNodes.push( node ); //simulate application's root node

                if( isGroupNode ) {
                    groupGraph.setAsGroup( node );
                    node.setGroupingAllowed( true );
                    groupGraph.setExpanded( node, false );
                }

                graphModel.nodeMap[ nodeData.uid ] = node;
            } else {
                var nodeCategory = 'Requirement';
                var rootNodeObject = nodeObject;
                var props = templateService.getBindPropertyNames( rootNodeObject );
                var flag = false;
                var template = templateService.getNodeTemplate( graphModel.nodeTemplates, props, false, flag );

                var isRoot = true;
                var bindData = templateService.getBindProperties( rootNodeObject, isRoot ); // Get the default node style properties.

                var defaultNodeStyle = graphModel.config.defaults.nodeStyle; // Get the node style properties defined by the legend.

                var legendNodeStyle = graphLegendSvc.getStyleFromLegend( 'objects', nodeCategory, activeLegendView );
                var preferenceNodeStyle = graphStyleService.getNodeStyle( 'WorkspaceStyle' );

                var nodeStyle = _.defaults( {}, preferenceNodeStyle, legendNodeStyle, defaultNodeStyle );

                if( nodeStyle ) {
                    bindData.node_fill_color = nodeStyle.borderColor;
                }

                if( graphModel.nodeCommandBindData ) {
                    declUtils.consolidateObjects( bindData, graphModel.nodeCommandBindData );
                }

                if( rootNodeObject.position ) {
                    nodeRect = rootNodeObject.position;
                }

                var node = graph.createNodeWithBoundsStyleAndTag( nodeRect, template, bindData );
                node.setMinNodeSize( MIN_NODE_SIZE );
                node.appData = {
                    id: rootNodeObject.uid,
                    nodeObject: rootNodeObject,
                    inDegrees: '1',
                    outDegrees: '0',
                    category: nodeCategory
                };

                graphModel.resourceRootId = rootNodeObject.uid;

                addedNodes.push( node );
                node.isRoot( true );
                graphModel.nodeMap[ rootNodeObject.uid ] = node;
            }
        } else {
            var bindData = templateService.getBindProperties( nodeObject, false );
            bindData.show_psp_image = false;
            bindData.show_subassembly_psp_image = false;
            if( nodeObject.props.MRMPSP ) {
                var topNodeUID = appCtxService.ctx.occmgmtContext.topElement.uid;
                if( topNodeUID === nodeObject.props.awb0Parent.dbValues[0] ) {
                    bindData.show_psp_image = true;
                } else {
                    bindData.show_subassembly_psp_image = true;
                }
            }

            // Update the node with the new data.
            graphModel.graphControl.graph.updateNodeBinding( graphModel.nodeMap[ nodeObject.uid ], bindData );
        }
    } );

    return addedNodes;
};

export default exports = {
    processNodeData
};
