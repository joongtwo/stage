// Copyright (c) 2022 Siemens

/**
 * This is the command handler for show/hide child occurrences command which is contributed to resource graph nodes
 *
 * @module js/MrmToggleChildOccsCommandHandler
 */
import appCtxSvc from 'js/appCtxService';
import aceBreadcrumbService from 'js/aceBreadcrumbService';
import awTableSvc from 'js/awTableService';
import graphService from 'js/awGraphService';
import mrmResourceGraphConstants from 'js/MrmResourceGraphConstants';
import mrmResourceGraphUtils from 'js/MrmResourceGraphUtils';

var exports = {};

export let getContextKeyFromBreadcrumbConfig = function( parentScope ) {
    return aceBreadcrumbService.getContextKeyFromBreadcrumbConfig( parentScope );
};

/**
 * It show/hide children for a group node
 * <P>
 *
 * @param {NodeModelObject} node - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 */
export let mrmToggleChildOccurences = function( graphModel, node, contextKey, data, dataCtxNode ) {
    if( graphModel && node && node.getItemType() === 'Node' ) {
        var graphControl = graphModel.graphControl;
        var groupGraph = graphControl.groupGraph;

        if( !groupGraph.isGroup( node ) ) {
            return;
        }

        var isExpanded = groupGraph.isExpanded( node );
        groupGraph.setExpanded( node, !isExpanded );
        var children = groupGraph.getChildNodes( node );
        if( !isExpanded && children.length === 0 ) {
            var resourceGraphDP = graphModel.graphDataProvider;

            if( resourceGraphDP.cursorObject ) {
                resourceGraphDP.cursorObject = null;
            }

            resourceGraphDP.startIndex = 0;

            var listLoadInput = awTableSvc.createListLoadInput( null, resourceGraphDP.startIndex, null, true );

            listLoadInput.parentUid = node.appData.id;
            listLoadInput.expandNode = true;
            listLoadInput.contextKey = contextKey;

            var actionRequestObj = {
                listLoadInput: listLoadInput
            };

            var action = resourceGraphDP.initializeAction;

            resourceGraphDP.someDataProviderSvc.executeLoadAction( action, resourceGraphDP.json, dataCtxNode,
                actionRequestObj ).then(
                function( response ) {
                    groupGraph.setExpanded( node, true );
                    updateExpandedNodeLayout( node, graphModel, isExpanded );

                    var vmCollection = resourceGraphDP.viewModelCollection;
                    vmCollection.setTotalObjectsFound( response.totalFound );

                    if( response.totalFound > 0 && response.results ) {
                        vmCollection.updateModelObjects( response.results, resourceGraphDP.uidInResponse,
                            resourceGraphDP.preSelection );
                    }

                    resourceGraphDP.syncSelectionModel( dataCtxNode );

                    return response;
                } );
        } else {
            updateExpandedNodeLayout( node, graphModel, isExpanded );
        }

        //update command selection state
        var bindData = node.getAppObj();
        var newBindData = {};
        newBindData.MRM0ToggleChildren_selected = !bindData.MRM0ToggleChildren_selected;
        newBindData.MRM0ToggleChildren_tooltip = isExpanded ? data.i18n.MRM0ShowChildrenTitle : data.i18n.MRM0HideChildrenTitle;
        newBindData.child_count = isExpanded ? children.length : '';
        graphControl.graph.updateNodeBinding( node, newBindData );

        var selectedObjects = appCtxSvc.ctx.occmgmtContext.selectedModelObjects;
        var numberOfSelectedObjects = selectedObjects.length;

        if ( numberOfSelectedObjects === 1 && selectedObjects[0].uid === node.appData.nodeObject.uid ) {
            //It changes width and height of the node when we do expand/shrink sub assembly's node.
            //in this case we need to change tranformation for add commands so that it placed at node as per new width and height of the node.
            mrmResourceGraphUtils.setGraphNodeAddCommandsTransformation( graphModel, node, true );
        }
    }
};

var incUpdateActive = function( layout ) {
    return layout && layout.type === 'IncUpdateLayout' && layout.isActive();
};

var updateExpandedNodeLayout = function( node, graphModel, isExpanded ) {
    var graphControl = graphModel.graphControl;
    //apply incremental update layout
    var layout = graphControl.layout;
    if( incUpdateActive( layout ) ) {
        layout.applyUpdate( function() {
            isExpanded ? layout.collapseGroupNode( node ) : layout.expandGroupNode( node );
        } );
    }
    var currectLayoutDirection = graphModel.config.layout.defaultOption;
    var currectLayoutOption = mrmResourceGraphConstants.MRMResourceLayoutOptions[ currectLayoutDirection ] || 'GcTopToBottomLayout';
    graphService.setActiveLayout( graphModel, currectLayoutOption );
};

export default exports = {
    getContextKeyFromBreadcrumbConfig,
    mrmToggleChildOccurences
};
