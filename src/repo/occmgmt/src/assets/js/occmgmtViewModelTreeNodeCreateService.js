// Copyright (c) 2022 Siemens

/**
 * @module js/occmgmtViewModelTreeNodeCreateService
 */
import appCtxSvc from 'js/appCtxService';
import awTableSvc from 'js/awTableService';
import cdmSvc from 'soa/kernel/clientDataModel';
import objectToCSIDGeneratorService from 'js/objectToCSIDGeneratorService';
import occmgmtIconService from 'js/occmgmtIconService';
import occmgmtUtils from 'js/occmgmtUtils';
import _ from 'lodash';

/**
 * ***********************************************************<BR>
 * Define external API<BR>
 * ***********************************************************<BR>
 */
var exports = {};

let treeNodeHandlers = {};

let _isJitterFreeRefreshBackButtonSupported = function( pciUid ) {
    var localPciUid = pciUid ? pciUid : appCtxSvc.ctx.aceActiveContext.context.currentState.pci_uid;
    if( localPciUid ) {
        var productContextInfo = cdmSvc.getObject( localPciUid );
        return occmgmtUtils.isFeatureSupported( productContextInfo, 'Awb0JitterFreeRefreshBackButton' );
    }
    return false;
};

let _applyVMNodeCreationStrategy = function( vmNode, vmNodeCreationStrategy ) {
    if( _.isUndefined( vmNode ) || _.isUndefined( vmNodeCreationStrategy ) ) {
        return vmNode;
    }

    let reuseVMNode = _.isUndefined( vmNodeCreationStrategy.reuseVMNode ) ? false : vmNodeCreationStrategy.reuseVMNode;
    let staleVMNodeUids = _.isUndefined( vmNodeCreationStrategy.staleVMNodeUids ) ? [] : vmNodeCreationStrategy.staleVMNodeUids;

    if( reuseVMNode && !_.includes( staleVMNodeUids, vmNode.uid ) ) {
        if( vmNodeCreationStrategy.referenceLoadedVMObjectUidsMap.has( vmNode.uid ) ) {
            let loadedVMNode = vmNodeCreationStrategy.referenceLoadedVMObjectUidsMap.get( vmNode.uid );

            delete vmNode.type;
            if( loadedVMNode.levelNdx <= 0 ) {
                // we should always create new object for root object.
                // the root objects are part of rootPath objects, if we share the same object
                // then it create problem while tree processing.
                vmNode = _.clone( _.assign( loadedVMNode, vmNode ) );
            } else {
                // we should share the same objects while sharing vmNodes.
                // else the __expandState VMOs might get out of sync with newly created VMNodes.
                vmNode = _.assign( loadedVMNode, vmNode );
            }
        }

        // clear expansion cache
        if( !_.isUndefined( vmNodeCreationStrategy.clearExpandState ) && vmNodeCreationStrategy.clearExpandState === true && !_.isUndefined( vmNode.__expandState ) ) {
            delete vmNode.__expandState;
        }

        // always re-evaluate isExpanded for view model tree node.
        if( !_.isUndefined( vmNode.isExpanded ) && vmNode.isExpanded === true &&
            ( _.isUndefined( vmNode.children ) || _.isEmpty( vmNode.children ) ) ) {
            delete vmNode.isExpanded;
        }

        // always clear the placeholder state with vmNode if any
        // let next code take care of applying placeholder state.
        if( !_.isUndefined( vmNode.isPlaceholder ) ) {
            delete vmNode.isPlaceholder;
        }

        // we should delete markForDeletion flag as we are here to create vmNode
        if( !_.isUndefined( vmNode.markForDeletion ) ) {
            delete vmNode.markForDeletion;
        }
    }
    return vmNode;
};

/**
 * @param {IModelObject} modelObj - IModelObject Information to base the new node upon.
 * @param {Number} childNdx - child Index
 * @param {Number} levelNdx - Level index
 * @param {String} vmNodeCreationStrategy - Strategy whether to reuse view model node from current view model collection.
 *
 * @return {ViewModelTreeNode} View Model Tree Node
 */
export let createVMNodeUsingModelObjectInfo = function( modelObj, childNdx, levelNdx, vmNodeCreationStrategy, pciUid ) {
    var displayName;

    if( modelObj.props && modelObj.props.object_string ) {
        displayName = modelObj.props.object_string.uiValues[ 0 ];
    } else {
        if( modelObj.toString ) {
            displayName = modelObj.toString();
        }
    }

    var occUid = modelObj.uid;
    var occType = modelObj.type;
    var props = modelObj.props;
    var nChild = props && props.awb0NumberOfChildren ? props.awb0NumberOfChildren.dbValues[ 0 ] : 0;

    if( !displayName ) {
        displayName = occUid;
    }

    var iconURL = occmgmtIconService.getTypeIconURL( modelObj, occType );

    var vmNode = awTableSvc.createViewModelTreeNode( occUid, occType, displayName, levelNdx, childNdx, iconURL, '' );

    vmNode.isLeaf = nChild <= 0;
    /**
     * "stableId" property on occurrence is intended to be used strictly for maintaining expansion state of nodes in
     * Tree views. DO NOT USE IT FOR OTHER PURPOSES.
     */
    if( props && props.awb0Parent && props.awb0CopyStableId ) {
        vmNode.stableId = objectToCSIDGeneratorService.getCloneStableIdChain( modelObj, 'TreeStyleCsidPath' );
        // The following line replaces all instances of "/" in the stableId property with ":" so that it is in sync with the value when sent by server.
        // This is a temporary change and should be rolled back as soon as "objectToCSIDGeneratorService" is changed to use ":" as separator.
        vmNode.stableId = vmNode.stableId.replace( /\//g, ':' );

        var isJitterFreeSupported = _isJitterFreeRefreshBackButtonSupported( pciUid );

        if( isJitterFreeSupported && !_.isUndefined( vmNode.stableId ) && !_.isEmpty( vmNode.stableId ) ) {
            if( vmNode.stableId.length > 1 ) {
                vmNode.alternateID = vmNode.stableId;
            }
        }
    }

    if( props && props.awb0BreadcrumbAncestor ) {
        vmNode.parentUid = props.awb0BreadcrumbAncestor.dbValues[ 0 ];
    }
    _.each( treeNodeHandlers, function( handler ) {
        if( handler.condition() ) {
            handler.callbackFunction( vmNode );
        }
    } );
    vmNode = _applyVMNodeCreationStrategy( vmNode, vmNodeCreationStrategy );
    return vmNode;
}; // _createVMNodeUsingModelObjectInfo

/**
 * Adds two numbers together.
 * @param {ViewModelTreeNode} vmNode Node being created.
 * @param {String} parentUid Parent uid of vm node.
 * @param {treeLoadInput} treeLoadInput treeLoadInput
 */
function _propogateParentInformationToVMNode( vmNode, parentUid, treeLoadInput ) {
    var vmc = appCtxSvc.ctx.aceActiveContext.context.vmc;
    if( vmc ) {
        var parentObjNdx = vmc.findViewModelObjectById( parentUid );
        var parentNode = vmc.getViewModelObject( parentObjNdx );

        if( parentNode && parentNode.isGreyedOutElement && !( treeLoadInput && treeLoadInput.isResetRequest ) ) {
            vmNode.isGreyedOutElement = parentNode.isGreyedOutElement;
        }
    }

    vmNode.parentUid = parentUid;
}

/**
 * @param {SoaOccurrenceInfo} occInfo - Occurrence Information returned by server
 * @param {Number} childNdx - child Index
 * @param {Number} levelNdx - Level index
 * @param {String} pciUid - PCI uid of the element which this node is going to represent
 * @param {String} parentUid - Parent uid of vm node
 * @param {String} vmNodeCreationStrategy - Strategy whether to reuse view model node from current view model collection.
 *
 * @return {ViewModelTreeNode} View Model Tree Node
 */
export let createVMNodeUsingOccInfo = function( occInfo, childNdx, levelNdx, pciUid, parentUid, modelObjectType, treeLoadInput, vmNodeCreationStrategy ) {
    var displayName = occInfo.displayName;
    var occUid = occInfo.occurrenceId;
    var occType = occInfo.underlyingObjectType;

    if( modelObjectType === undefined || modelObjectType === null ) {
        modelObjectType = occType;
    }
    var occurrenceObject = cdmSvc.getObject( occUid );
    var props = occurrenceObject && occurrenceObject.props;
    var nChild = props && props.awb0NumberOfChildren ? props.awb0NumberOfChildren.dbValues[ 0 ] :
        occInfo.numberOfChildren;

    if( !displayName ) {
        displayName = occUid;
    }

    var iconURL = occmgmtIconService.getTypeIconURL( occInfo, occType );

    var vmNode = awTableSvc.createViewModelTreeNode( occUid, modelObjectType, displayName, levelNdx, childNdx, iconURL, '' );

    vmNode.isLeaf = nChild <= 0;
    /**
     * "stableId" property on occurrence is intended to be used strictly for maintaining expansion state of nodes in
     * Tree views. DO NOT USE IT FOR OTHER PURPOSES.
     */
    vmNode.stableId = occInfo.stableId;
    vmNode.pciUid = pciUid;
    let contextKey;
    if( treeLoadInput && treeLoadInput.subPanelContext ) {
        contextKey = treeLoadInput.subPanelContext.contextKey;
    } else if( appCtxSvc.ctx.aceActiveContext ) {
        contextKey = appCtxSvc.ctx.aceActiveContext.key;
    }
    vmNode.contextKey = contextKey;

    var isJitterFreeSupported = _isJitterFreeRefreshBackButtonSupported( pciUid );

    if( isJitterFreeSupported ) {
        // In case of insertLevel the occInfo.stableId is empty for the new occurrences returned as a part of newElementInfos in the SOA response.
        // So, compute it from the occInfo.
        var stableId = vmNode.stableId;
        if( !stableId && occInfo.occurrence && occInfo.occurrence.props && occInfo.occurrence.props.awb0Parent && occInfo.occurrence.props.awb0CopyStableId ) {
            stableId = objectToCSIDGeneratorService.getCloneStableIdChain( occInfo.occurrence, 'TreeStyleCsidPath' );
            stableId = stableId.replace( /\//g, ':' );
        } else if( !stableId && !_.isUndefined( occInfo ) && ( _.isUndefined( occInfo.occurrence ) || _.isUndefined( occInfo.occurrence.props ) ) ) {
            var occurrence = cdmSvc.getObject( occInfo.occurrenceId );
            if( !_.isUndefined( occurrence ) && occurrence !== null ) {
                stableId = objectToCSIDGeneratorService.getCloneStableIdChain( occurrence, 'TreeStyleCsidPath' );
                stableId = stableId.replace( /\//g, ':' );
            }
        }

        if( !_.isUndefined( stableId ) && !_.isEmpty( stableId ) ) {
            if( stableId.length > 1 ) {
                vmNode.alternateID = stableId;
            }
        }
    }

    if( parentUid ) {
        _propogateParentInformationToVMNode( vmNode, parentUid, treeLoadInput );
    }

    _.each( treeNodeHandlers, function( handler ) {
        if( handler.condition( treeLoadInput ) ) {
            handler.callbackFunction( vmNode );
        }
    } );
    vmNode = _applyVMNodeCreationStrategy( vmNode, vmNodeCreationStrategy );
    return vmNode;
};

export let createVMNodesForGivenOccurrences = function( childOccInfos, levelNdx, pciUid, elementToPciMap, parentUid, treeLoadInput, vmNodeCreationStrategy ) {
    var vmNodes = [];

    for( var childNdx = 0; childNdx < childOccInfos.length; childNdx++ ) {
        var elementPciUid = pciUid;

        if( elementToPciMap && elementToPciMap[ childOccInfos[ childNdx ].occurrenceId ] ) {
            elementPciUid = elementToPciMap[ childOccInfos[ childNdx ].occurrenceId ];
        }

        var modelObject = cdmSvc.getObject( childOccInfos[ childNdx ].occurrenceId );
        var modelObjectType = null;
        if( modelObject ) {
            modelObjectType = modelObject.type;
        }
        var vmNode = exports.createVMNodeUsingOccInfo( childOccInfos[ childNdx ], childNdx, levelNdx, elementPciUid, parentUid, modelObjectType, treeLoadInput, vmNodeCreationStrategy );
        vmNodes.push( vmNode );
    }

    return vmNodes;
};

export let registerTreeNodeHandler = ( handler ) => {
    treeNodeHandlers[ handler.key ] = handler;
    return treeNodeHandlers[ handler.key ];
};

export let unRegisterTreeNodeHandler = ( handler ) => {
    return delete treeNodeHandlers[ handler.key ];
};

export default exports = {
    createVMNodeUsingModelObjectInfo,
    createVMNodeUsingOccInfo,
    createVMNodesForGivenOccurrences,
    registerTreeNodeHandler,
    unRegisterTreeNodeHandler
};
