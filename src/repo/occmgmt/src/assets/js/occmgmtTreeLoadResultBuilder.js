// Copyright (c) 2022 Siemens

/**
 * @module js/occmgmtTreeLoadResultBuilder
 */
import appCtxSvc from 'js/appCtxService';
import cdmSvc from 'soa/kernel/clientDataModel';
import awStateService from 'js/awStateService';
import awTableSvc from 'js/awTableService';
import contextStateMgmtService from 'js/contextStateMgmtService';
import occmgmtUtils from 'js/occmgmtUtils';
import occmgmtStateHandler from 'js/occurrenceManagementStateHandler';
import occmgmtVMTNodeCreateService from 'js/occmgmtViewModelTreeNodeCreateService';
import occmgmtGetOccsResponseService from 'js/occmgmtGetOccsResponseService';
import occmgmtTreeTableStateService from 'js/occmgmtTreeTableStateService';
import aceStaleRowMarkerService from 'js/aceStaleRowMarkerService';
import aceExpandBelowService from 'js/aceExpandBelowService';
import aceRestoreBWCStateService from 'js/aceRestoreBWCStateService';
import awTableStateService from 'js/awTableStateService';
import _ from 'lodash';

/**
 * Return Level Index of VM node based on its position in Parent Children Map and CDM cache.
 */

var getVMNodeLevelIndex = function( treeLoadOutput, parentChildrenInfos, node ) {
    /*
     *startLevelNdx -1 makes sure that first level is shown at 0th levelNdx. But in case of topNode display,
      topNode gets added at 0th level. So, startLevelNdx should be 0 in that case.
     */
    var startLevelNdx = treeLoadOutput.showTopNode ? 0 : -1;
    if( node ) {
        var parentNode = node;
        while( parentNode ) {
            parentNode = getParentVMNodeInfo( parentChildrenInfos, parentNode );
            if( parentNode ) {
                node = parentNode;
                startLevelNdx++;
            }
        }

        while( node.uid || node.occurrenceId ) {
            var parentUid = occmgmtUtils.getParentUid( cdmSvc.getObject( node.uid ? node.uid : node.occurrenceId ) );

            if( parentUid ) {
                startLevelNdx++;
            }

            node = {
                uid: parentUid,
                occurrenceId: parentUid

            };
        }
    }

    return startLevelNdx;
};

var getVMNodeLevelIndexByTraversingParentInCdm = function( showTopNode, uid ) {
    /*
     *startLevelNdx -1 makes sure that first level is shown at 0th levelNdx. But in case of topNode display,
      topNode gets added at 0th level. So, startLevelNdx should be 0 in that case.
     */
    var startLevelNdx = showTopNode ? 0 : -1;
    while( uid ) {
        var parentUid = occmgmtUtils.getParentUid( cdmSvc.getObject( uid ) );

        if( parentUid ) {
            startLevelNdx++;
        }

        uid = parentUid;
    }

    return startLevelNdx;
};

var getParentVMNodeInfo = function( parentChildrenInfos, node ) {
    var parentInfo = null;

    for( var parentChildIdx = 0; parentChildIdx < parentChildrenInfos.length; parentChildIdx++ ) {
        for( var childrenIdx = 0; childrenIdx < parentChildrenInfos[ parentChildIdx ].childrenInfo.length; childrenIdx++ ) {
            if( node.uid === parentChildrenInfos[ parentChildIdx ].childrenInfo[ childrenIdx ].occurrenceId ||
                node.occurrenceId === parentChildrenInfos[ parentChildIdx ].childrenInfo[ childrenIdx ].occurrenceId ) {
                parentInfo = parentChildrenInfos[ parentChildIdx ].parentInfo;
                break;
            }
        }
    }

    return parentInfo;
};

const setAutoSavedSessiontime = ( isProductInteracted, contextState, treeLoadOutput, response ) => {
    if( !isProductInteracted || _.isEqual( contextState.context.requestPref.savedSessionMode, 'ignore' ) ) {
        treeLoadOutput.autoSavedSessiontimeForRestoreOption = response.userWorkingContextInfo.autoSavedSessiontime;
    }
};

/**
 *
 * @param {*} treeLoadInput treeLoadInput structure
 * @param {*} treeLoadOutput treeLoadOput structure used to treeLoadResult
 * @param {*} response getOccurrences response
 */
const _updateTopNodeRelatedInformationInOutputStructure = ( treeLoadInput, treeLoadOutput, response ) => {
    var uwci = response.userWorkingContextInfo;
    treeLoadOutput.sublocationAttributes = uwci ? uwci.sublocationAttributes : {};
    treeLoadOutput.changeContext = null;

    if( treeLoadOutput.sublocationAttributes && treeLoadOutput.sublocationAttributes.awb0ActiveSublocation ) {
        treeLoadOutput.tabNameToActivate = treeLoadOutput.sublocationAttributes.awb0ActiveSublocation[ 0 ];
    }

    if( response.requestPref ) {
        treeLoadOutput.requestPref.isStaleStructure = response.requestPref.isStaleStructure;
    }

    treeLoadOutput.showTopNode = _shouldTopNodeBeDisplayed( treeLoadOutput );

    if( treeLoadOutput.showTopNode === true ) {
        let addTopNodeOcc = _.isEmpty( response.parentChildrenInfos ) || !_.isEmpty( response.parentChildrenInfos ) && response.parentChildrenInfos.length === 1 && _.isEmpty( response
            .parentChildrenInfos[ 0 ].childrenInfo );
        if( addTopNodeOcc === true ) {
            treeLoadOutput.topNodeOccurrence = [];
            treeLoadOutput.topNodeOccurrence.push( response.parentOccurrence );
            delete treeLoadOutput.expandParent;
        }
    }

    _buildRootPathNodes( treeLoadInput.subPanelContext, treeLoadOutput, response );
    _updateNewTopNodeRelatedInformation( treeLoadInput, treeLoadOutput );
};

/**
 *
 * @param {*} treeLoadInput treeLoadInput structure
 * @param {*} treeLoadOutput treeLoadOput structure used to treeLoadResult
 */
const _updateNewTopNodeRelatedInformation = ( treeLoadInput, treeLoadOutput ) => {
    if( treeLoadOutput.rootPathNodes && treeLoadOutput.rootPathNodes.length > 0 ) {
        var firstNode = _.first( treeLoadOutput.rootPathNodes );

        treeLoadOutput.newTopNode = firstNode;

        if( firstNode.uid !== treeLoadInput.parentNode.uid || treeLoadOutput.deltaTreeResponse ) {
            treeLoadOutput.topModelObject = cdmSvc.getObject( firstNode.uid );
            treeLoadOutput.baseModelObject = cdmSvc.getObject( firstNode.uid );
        }
    }
};

/**
 * Function
 *
 * @param {*} parentModelObj parentOccurrence of getOccurrences response
 * @returns{*} rootPath Hierarchy for given parentModelObj
 */
const _buildRootPathObjects = ( parentModelObj ) => {
    /**
     * Determine the path to the 'root' occurrence IModelObject starting at the immediate 'parent' (t_uid)
     * object.
     */
    var rootPathObjects = [];
    var pathModelObject = parentModelObj;

    if( pathModelObject ) {
        var pathParentUid = occmgmtUtils.getParentUid( pathModelObject );
        rootPathObjects.push( pathModelObject );

        while( pathModelObject && pathParentUid ) {
            pathModelObject = cdmSvc.getObject( pathParentUid );

            if( pathModelObject ) {
                rootPathObjects.push( pathModelObject );
                pathParentUid = occmgmtUtils.getParentUid( pathModelObject );
            }
        }
    }

    return rootPathObjects;
};

var _isParentInResponseAlreadyExpandedInTree = function( viewModelCollection, parentChildrenInfo ) {
    if( _.isUndefined( viewModelCollection ) || _.isUndefined( parentChildrenInfo ) ) {
        return false;
    }
    var parentNodeNdx = viewModelCollection.findViewModelObjectById( parentChildrenInfo.parentInfo.occurrenceId );
    if( parentNodeNdx !== -1 ) {
        var parentNode = viewModelCollection.getViewModelObject( parentNodeNdx );
        return parentNode.isExpanded;
    }
    return false;
};


// Check if the parent is fully expanded and in sync with the response
var _isParentFullyExpandedAndInSyncWithResponse = function( viewModelCollection, parentChildrenInfo ) {
    if( _.isUndefined( viewModelCollection ) || _.isUndefined( parentChildrenInfo ) ) {
        return false;
    }
    var parentNodeNdx = viewModelCollection.findViewModelObjectById( parentChildrenInfo.parentInfo.occurrenceId );
    if( parentNodeNdx !== -1 ) {
        var parentNode = viewModelCollection.getViewModelObject( parentNodeNdx );
        if( parentNode.isExpanded && parentChildrenInfo && parentChildrenInfo.parentInfo && parentChildrenInfo.childrenInfo &&
            ( _.isEqual( parentChildrenInfo.parentInfo.occurrenceId, parentNode.uid ) || _.isEqual( parentChildrenInfo.parentInfo.uid, parentNode.uid ) ) &&
            !_.isEqual( parentChildrenInfo.childrenInfo.length, parentNode.children.length ) ) {
            // There is mismatch in the tree children count with the children present in response for the parent.
            // We can not proceed with merging new nodes.
            return true;
        }
    }
    return false;
};

var _updateVmNodeCreationStrategyForRootPathNodes = function( subPanelContext, vmNodeCreationStrategy, response, rootPathObjects ) {
    if( _.isUndefined( vmNodeCreationStrategy ) || _.isUndefined( response ) ||
         _.isUndefined( rootPathObjects ) || _.isEmpty( rootPathObjects ) ||
         response.requestPref && response.requestPref.deltaTreeResponse ) {
        return;
    }
    // LCS-686481 - To avoid jitter we are setting reuseVMNode as false for multilevel response.
    // Details can be found in DSP of LCS-686481
    if( !_.isUndefined( response.parentChildrenInfos ) ) {
        for( let ndx = rootPathObjects.length - 1; ndx >= 0; ndx-- ) {
            let parentChildrenInfo = _.filter( response.parentChildrenInfos, function( parentChildrenInfo ) {
                return parentChildrenInfo.parentInfo.occurrenceId === rootPathObjects[ ndx ].uid;
            } );
            if( !_.isEmpty( parentChildrenInfo ) ) {
                let isParentInResponseAlreadyExpanded = _isParentInResponseAlreadyExpandedInTree( subPanelContext.occContext.vmc, parentChildrenInfo[ 0 ] );
                if( isParentInResponseAlreadyExpanded ) {
                    vmNodeCreationStrategy.reuseVMNode = false;
                }
            }
        }
    }
};

/**
 * Function
 *
 * @param {*} response getOccurrences response
 * @param {*} rootPathObjects rootPathObjects
 * @param {*} pciUid ProductContextInfo UID
 * @param {*} treeLoadOutput treeLoadOutput structure
 * @returns{*} rootPath Hierarchy for given rootPathObjects
 */
const _buildRootPath = ( subPanelContext, response, rootPathObjects, pciUid, treeLoadOutput ) => {
    /**
     * Determine the path to the 'root' occurrence IModelObject starting at the immediate 'parent' (t_uid)
     * object.
     */
    var rootPathNodes = [];

    /**
     * Determine new 'top' node by walking back from bottom-to-top of the rootPathObjects and creating nodes to
     * wrap them.
     */
    var nextLevelNdx = -1;
    _updateVmNodeCreationStrategyForRootPathNodes( subPanelContext, treeLoadOutput.vmNodeCreationStrategy, response, rootPathObjects );
    for( var ndx = rootPathObjects.length - 1; ndx >= 0; ndx-- ) {
        let vmNodeCreationStrategy;
        if( treeLoadOutput.vmNodeCreationStrategy ) {
            vmNodeCreationStrategy = _.clone( treeLoadOutput.vmNodeCreationStrategy );
            vmNodeCreationStrategy.cloneObject = true;
        }
        var currNode = occmgmtVMTNodeCreateService.createVMNodeUsingModelObjectInfo( rootPathObjects[ ndx ], 0, nextLevelNdx++, vmNodeCreationStrategy, pciUid );
        var rootPathNodesLength = rootPathObjects.length - 1;
        /**
         * Note: We mark all necessary 'parent' path nodes as 'placeholders' so that we can find them later and
         * fill them out as needed (when they come into view)
         */
        var isPlaceholder = !( ndx === rootPathNodesLength || treeLoadOutput.showTopNode && ndx === rootPathNodesLength - 1 );
        currNode.isExpanded = true;

        //TopNode for empty structure. Should not be set as expanded. it makes getOcc call otherwise
        if( !_.isEmpty( treeLoadOutput.topNodeOccurrence ) ) {
            currNode.isExpanded = false;
        }

        if( ndx === 0 && response.cursor ) {
            currNode.cursorObject = response.cursor;
        }

        currNode.isPlaceholder = isPlaceholder;

        //If we have elementToPCIMap populated,
        //we can take pci corresponding to the currNode.uid's entry
        if( treeLoadOutput.elementToPCIMap ) {
            if( treeLoadOutput.elementToPCIMap[ currNode.uid ] ) {
                pciUid = treeLoadOutput.elementToPCIMap[ currNode.uid ];
            }
        }

        currNode.pciUid = pciUid;

        rootPathNodes.push( currNode );
    }

    return rootPathNodes;
};

function _getOccurrenceId( response, occurrenceId ) {
    if( _.isUndefined( occurrenceId ) ) {
        let parentOccurrence = response.parentOccurrence;
        if( !_.isEmpty( parentOccurrence.occurrenceId ) ) {
            return parentOccurrence.occurrenceId;
        }

        let parentChildrenInfo = response.parentChildrenInfos[ 0 ];
        if( parentChildrenInfo && !_.isEmpty( parentChildrenInfo.parentInfo ) ) {
            return parentChildrenInfo.parentInfo.occurrenceId;
        }
    }
    return occurrenceId;
}

/**
 */
function _buildRootPathNodes( subPanelContext, treeLoadOutput, response, occurrenceId ) {
    occurrenceId = _getOccurrenceId( response, occurrenceId );
    if( cdmSvc.isValidObjectUid( occurrenceId ) ) {
        var parentOccurrenceObject = cdmSvc.getObject( occurrenceId );
        var rootPathObjects = _buildRootPathObjects( parentOccurrenceObject );
        var addExtraTopNodeInRootPathHierarchy = treeLoadOutput.showTopNode && _.isEmpty( treeLoadOutput.topNodeOccurrence );

        if( addExtraTopNodeInRootPathHierarchy === true ) {
            var topNode = _.last( rootPathObjects );
            rootPathObjects.push( topNode );
        }

        var rootPathNodes = _buildRootPath( subPanelContext, response, rootPathObjects, treeLoadOutput.productContextInfo.uid, treeLoadOutput );

        if( rootPathNodes.length > 0 ) {
            treeLoadOutput.rootPathNodes = rootPathNodes;
        }

        return rootPathNodes;
    }
}

/**
 *
 */
const _shouldTopNodeBeDisplayed = ( treeLoadOput ) => {
    if( treeLoadOput.supportedFeatures[ '4GStructureFeature' ] || treeLoadOput.isOpenedUnderAContext ) {
        return false;
    }
    return true;
};

/**
 * Function to check if Awb0EnableColorFilterFeature is returned in the PCI.
 * We will set the decoratorToggle's value based on the feature.
 * @param {*} treeLoadOutput treeLoadOput structure used to treeLoadResult
 */
const _updateColorToggleRelatedInfo = ( treeLoadOutput ) => {
    if( treeLoadOutput.supportedFeatures.Awb0EnableColorFilterFeature === true ) {
        treeLoadOutput.decoratorToggle = true;
        treeLoadOutput.supportsColorToggleCommand = true;
    }
};

/**
 *
 */
function _buildTreeLoadOutputInfo( treeLoadInput, treeLoadOutput, response, newState, contextState, occContext ) {
    //Values from different sources get copied to treeLoadResult. treeLoadInput, response, ctx etc. That needs unification.
    //We will create treeLoadOutput and copy that into basic treeLoadResult rather than updating basic treeLoadResult at different points.

    //Opened object is assembly/sub-assembly that user has navigated into.
    treeLoadOutput.openedModelObject = cdmSvc.getObject( newState.o_uid );
    treeLoadOutput.openedElement = cdmSvc.getObject( newState.o_uid );
    treeLoadOutput.topElement = cdmSvc.getObject( newState.t_uid );

    //But in case of trees, there is no navigation ( but expansion ). So, openedModelObject is always TopNode/t_uid.
    if( occmgmtUtils.isTreeView() ) {
        treeLoadOutput.openedModelObject = cdmSvc.getObject( newState.t_uid );
    }

    treeLoadOutput.retainTreeExpansionStates = treeLoadInput.retainTreeExpansionStates;
    if( !treeLoadInput.isTopNode ) {
        treeLoadOutput.expandParent = treeLoadInput.expandParent;
    }
    treeLoadOutput.filter = response.filter;

    treeLoadOutput.configContext = {};
    treeLoadOutput.startFreshNavigation = false;
    treeLoadOutput.elementToPCIMap = occmgmtGetOccsResponseService.updateElementToPCIMap( response, contextState );
    treeLoadOutput.elementToPCIMapCount = treeLoadOutput.elementToPCIMap ? Object.keys( treeLoadOutput.elementToPCIMap ).length : 0;
    treeLoadOutput.isFocusedLoad = treeLoadInput.isFocusedLoad;
    treeLoadOutput.vmNodeCreationStrategy = treeLoadInput.vmNodeCreationStrategy;

    treeLoadOutput.requestPref = {
        savedSessionMode: appCtxSvc.ctx.requestPref ? appCtxSvc.ctx.requestPref.savedSessionMode : 'restore',
        criteriaType: contextState.context.requestPref.criteriaType,
        showUntracedParts: contextState.context.requestPref.showUntracedParts,
        recipeReset: !_.isUndefined( response.requestPref ) && response.requestPref.recipeReset ? response.requestPref.recipeReset[ 0 ] : 'false',
        reloadDependentTabs: !_.isUndefined( response.requestPref ) && response.requestPref.reloadDependentTabs ? response.requestPref.reloadDependentTabs[ 0 ] : undefined
    };

    treeLoadOutput.searchFilterCategories = response.filter.searchFilterCategories;
    treeLoadOutput.searchFilterMap = response.filter.searchFilterMap;

    if( !_.isUndefined( occContext.showTopNode ) ) {
        treeLoadOutput.showTopNode = occContext.showTopNode;
    }
    /**
     *
     * treeLoadInput.isFocusedLoad will be true in requrest to dataProvider if is is focus action ( user searched for something which is not loaded)
     * Other use case is, user opened a structure. So, instead of sending first level, server sent multiple levels around last saved selection.
     * So, this is focus use case but triggered from server side. In this case also, isFocusedLoad should be true.
     */
    var focusChildOccInfo = response.focusChildOccurrence;
    if( !_.isEmpty( focusChildOccInfo.occurrenceId ) && cdmSvc.isValidObjectUid( focusChildOccInfo.occurrenceId ) ) {
        treeLoadOutput.isFocusedLoad = true;
    }

    var pci_uid = newState.pci_uid;

    if( treeLoadInput.skipFocusOccurrenceCheck && contextState.occContext.previousState ) {
        pci_uid = contextState.occContext.previousState.pci_uid;
    }

    treeLoadOutput.productContextInfo = cdmSvc.getObject( pci_uid );

    // TODO: In Aw6.0 while applying filter, this line gives error
    // Commented it out as per Amol's suggestion
    // if( treeLoadInput.clearExistingSelections ) {
    //     contextState.context.pwaSelectionModel.selectNone();
    // }
    var isJitterFreeSupported = occmgmtUtils.isFeatureSupported( treeLoadOutput.productContextInfo, 'Awb0JitterFreeRefreshBackButton' );
    if( isJitterFreeSupported && treeLoadInput.openOrUrlRefreshCase === 'open' && !contextState.context.currentState.retainTreeExp ) {
        treeLoadOutput.retainTreeExpansionStatesForOpen = false;
    }

    if( treeLoadOutput.productContextInfo.uid.endsWith( 'AWBIB' ) ) {
        // Stale UID marker is applicable when ACE tree presented indexed structure.
        // We can not rely on feature such as 'Awb0EnableFilterInFullTextSearchFeature' as feature is populated when
        // structure is indexed and user wants to leverage indexed search.
        aceStaleRowMarkerService.updateCtxWithStaleUids( response.requestPref, response.occurrences, response.parentChildrenInfos, occContext );
    }
}

/**
 *
 */
const _setFirstRootPathNodeAsTopModelObjectInOuputStructure = ( treeLoadInput, treeLoadOutput ) => {
    if( treeLoadOutput.rootPathNodes ) {
        var topNode = _.first( treeLoadOutput.rootPathNodes );
        /**
         * Earlier we used to build tree level by level. So, when level 0 was built last, topModelObject and
         * baseModelObject were set to RootNode.As we are processing all levels in one call, that is not
         * taking place. Ideally, when we are rendering levels, at each level topModelObject and
         * baseModelObject should be RootNode.
         */
        if( treeLoadInput.parentNode.levelNdx === -1 ) {
            treeLoadOutput.topModelObject = cdmSvc.getObject( topNode.uid );
            treeLoadOutput.baseModelObject = cdmSvc.getObject( topNode.uid );
            treeLoadOutput.openedModelObject = cdmSvc.getObject( topNode.uid );
        }
    }
};

/**
 *
 */
const _updateVMNodesWithIncompleteHeadTailInfo = ( cursorInfo, vmNodes ) => {
    var headChild = _.head( vmNodes );
    var lastChild = _.last( vmNodes );

    if( !cursorInfo.startReached ) {
        headChild.incompleteHead = true;
    }

    if( !cursorInfo.endReached ) {
        lastChild.incompleteTail = true;
    }
};

var _isRootPathNodeInSyncWithResponse = function( viewModelCollection, rootPathNode, treeLoadOutput, response ) {
    if( rootPathNode.parentUid ) {
        var rootPathNodeParentNdx = viewModelCollection.findViewModelObjectById( rootPathNode.parentUid );
        if( rootPathNodeParentNdx !== -1 ) {
            var rootPathNodeParent = viewModelCollection.getViewModelObject( rootPathNodeParentNdx );

            if( rootPathNodeParent && rootPathNodeParent.children ) {
                for( var i = 0; i < response.parentChildrenInfos.length; i++ ) {
                    var info = response.parentChildrenInfos[ i ];

                    if( info && info.parentInfo && info.childrenInfo &&
                        ( _.isEqual( info.parentInfo.occurrenceId, rootPathNodeParent.uid ) || _.isEqual( info.parentInfo.uid, rootPathNodeParent.uid ) ) &&
                        !_.isEqual( info.childrenInfo.length, rootPathNodeParent.children.length ) ) {
                        // There is mismatch in the tree children count with the children present in response for the parent.
                        // We can not proceed with merging new nodes.
                        treeLoadOutput.mergeNewNodesInCurrentlyLoadedTree = false;
                        return;
                    }
                }
            }
            // else the parent of rootPathNode is collapsed.
        }
    }
};

var _populateMergeNewNodesInCurrentyLoadedTreeParameter = function( treeLoadOutput, declViewModel, response ) {
    var viewModelCollection = occmgmtUtils.getCurrentTreeDataProvider( declViewModel.dataProviders ).viewModelCollection;

    //Setting mergeNewNodesInCurrentlyLoadedTree always to true is no harm.
    treeLoadOutput.mergeNewNodesInCurrentlyLoadedTree = true;

    //If user has searched for an element whose parent was already expanded(and partially loaded), disable merge.
    //No mechanism to figure out where new page that has come belongs (below/above/middle of existing nodes).
    //It would create a scenario of multiple cursors for given parent.
    var lastParentChildrenInfo = _.last( response.parentChildrenInfos );
    var isParentInResponseAlreadyExpanded = _isParentFullyExpandedAndInSyncWithResponse( viewModelCollection, lastParentChildrenInfo );

    if( isParentInResponseAlreadyExpanded ) {
        treeLoadOutput.mergeNewNodesInCurrentlyLoadedTree = false;
        return;
    }

    //Objects in RootPath already present in Tree, as placeholder parents, or as expanded sub-assemblies having has incomplete structure (incomplete head/tail).
    //do not merge new results into currently loaded tree if parents are incomplete as it will lead to parent with multiple incomplete sections in parent and
    //multiple cursors. This will leave tree in weird state. For BVR , this scenario will not arise as BVR sends all nodes at given level.
    _.forEach( treeLoadOutput.rootPathNodes, function( rootPathNode ) {
        var rootPathNodeNdx = viewModelCollection.findViewModelObjectById( rootPathNode.uid );

        if( rootPathNodeNdx !== -1 ) {
            var rootPathParentNode = viewModelCollection.getViewModelObject( rootPathNodeNdx );

            // Fix for LCS-690988
            // If all the child's of the rootPathParentNode's are loaded then we need not check for isPlaceholder
            // Tree merge should happen as cdm has all the nodes already loaded
            // Rely on the cursor information to determine this
            if( !_.isUndefined( rootPathParentNode.cursorObject ) && !( rootPathParentNode.cursorObject.startReached && rootPathParentNode.cursorObject.endReached ) ) {
                treeLoadOutput.mergeNewNodesInCurrentlyLoadedTree = false;
                return;
            }

            var firstChildOfRootPathParentNode = _.first( rootPathParentNode.children );
            var lastChildOfRootPathParentNode = _.last( rootPathParentNode.children );

            if( firstChildOfRootPathParentNode && firstChildOfRootPathParentNode.incompleteHead ||
                lastChildOfRootPathParentNode && lastChildOfRootPathParentNode.incompleteTail ) {
                treeLoadOutput.mergeNewNodesInCurrentlyLoadedTree = false;
                return;
            }
        } else {
            _isRootPathNodeInSyncWithResponse( viewModelCollection, rootPathNode, treeLoadOutput, response );
        }
    } );
};

/*
 */
function _updateChildrenOfRootPathNode( treeLoadInput, treeLoadOutput, childVMNodes ) {
    if( !_.isUndefined( treeLoadOutput.rootPathNodes ) && !_.isEmpty( treeLoadOutput.rootPathNodes ) ) {
        // We are here because we have single parent-children recieved in response.
        // In such scenario, framework explicitly checks if UIDs are changed between input parent node and rootPathNode
        // and based on that, takes decision whether to update children to parent node or root path node.
        // But with delta response or cases line restore from 'Global( Latest Working )' to 'Latest Working',
        // since the uids are going to remain same, root path node does not get updated for children property
        // correctly. This results in jitter for successive actions.
        // To tackle the issue, we are updating the children of root path node upfront.
        var lastNode = _.last( treeLoadOutput.rootPathNodes );
        if( !_.isUndefined( lastNode ) && treeLoadInput.parentNode.uid === lastNode.uid ) {
            lastNode.children = _.clone( childVMNodes );
        }
    }
}

/**
 */
function _createChildOccurrences( treeLoadInput, treeLoadOutput, response, newState, declViewModel, contextState, levelNdx, vmNodeStates, isTopNode ) {
    var vmNodes = [];

    if( !_.isEmpty( response.parentChildrenInfos ) ) {
        // There is a possibility of non root path data being sent from server. Validate and set the flag here.
        _setFirstRootPathNodeAsTopModelObjectInOuputStructure( treeLoadInput, treeLoadOutput );
        var parentNodeUnderAction = treeLoadOutput.rootPathNodes ? treeLoadOutput.rootPathNodes[ 0 ].uid : treeLoadInput.parentElement;

        treeLoadOutput.vmNodesInTreeHierarchyLevels = [];
        treeLoadOutput.nonRootPathHierarchicalData = true;

        if( !_.isUndefined( declViewModel ) ) {
            vmNodes = _populateViewModelTreesNodesInTreeHierarchyFormatForTopDown( treeLoadInput, treeLoadOutput, response, declViewModel, contextState );

            if( treeLoadOutput.vmNodesInTreeHierarchyLevels ) {
                _updateVMNodesWithChildrenAndCountInformation( treeLoadInput, treeLoadOutput, declViewModel, vmNodeStates );
                vmNodes = getVMNodeChildren( treeLoadOutput.vmNodesInTreeHierarchyLevels, parentNodeUnderAction );
            }
        }
    } else {
        var childOccInfos = [];
        if( !_.isEmpty( response.occurrences ) ) {
            childOccInfos = response.occurrences;
        }
        // TODO - below code still not provide jitter free behaviour in case of SWC, we need to revisit it.
        levelNdx = treeLoadOutput.showTopNode && isTopNode ? 1 : levelNdx; // children of top node will be at first level
        vmNodes = occmgmtVMTNodeCreateService.createVMNodesForGivenOccurrences( childOccInfos, levelNdx, newState.pci_uid, treeLoadOutput.elementToPCIMap,
            null, treeLoadInput, treeLoadOutput.vmNodeCreationStrategy );
        _updateChildrenOfRootPathNode( treeLoadInput, treeLoadOutput, vmNodes );
    }

    return vmNodes;
}

var _populateViewModelTreesNodesInTreeHierarchyFormat = function( treeLoadOutput, response, treeLoadInput ) {
    var vmNodesInTreeHierarchyLevels = [];
    var levelNdx = -1;
    var vmNodes = [];
    var rootPathNodesLength = treeLoadOutput.rootPathNodes.length - response.parentChildrenInfos.length + 1;

    //Build levels of placeholder parents
    for( var ndx = 0; ndx < rootPathNodesLength; ndx++, levelNdx++ ) {
        vmNodesInTreeHierarchyLevels.push( [ treeLoadOutput.rootPathNodes[ ndx ] ] );
    }
    //Parent level from which occurrences have been returned
    var startLevelNdx = levelNdx;
    _.forEach( response.parentChildrenInfos, function( parentChildInfo ) {
        // eslint-disable-next-line max-len
        vmNodes = occmgmtVMTNodeCreateService.createVMNodesForGivenOccurrences( parentChildInfo.childrenInfo, levelNdx, treeLoadOutput.currentState.pci_uid, treeLoadOutput.elementToPCIMap,
            parentChildInfo.parentInfo.occurrenceId, treeLoadInput, treeLoadOutput.vmNodeCreationStrategy );
        //If level is incomplete (head/tail), update VM Nodes with that info
        _updateVMNodesWithIncompleteHeadTailInfo( parentChildInfo.cursor, vmNodes );
        vmNodesInTreeHierarchyLevels.push( vmNodes );
        levelNdx++;
    } );

    //Update cursor information on VM Nodes
    _.forEach( response.parentChildrenInfos, function( parentChildInfo ) {
        var parentViewModelTreeNode = vmNodesInTreeHierarchyLevels[ startLevelNdx ].filter( function( vmo ) {
            return vmo.id === parentChildInfo.parentInfo.occurrenceId;
        } )[ 0 ];
        parentViewModelTreeNode.cursorObject = parentChildInfo.cursor;
        startLevelNdx++;
    } );

    treeLoadOutput.vmNodesInTreeHierarchyLevels = vmNodesInTreeHierarchyLevels;
    return vmNodes;
};

function _findPlaceHolderParentsInRootPathNodes( parentChildrenInfos, rootPathNodes ) {
    var allParents = _.map( parentChildrenInfos, function( parentChildrenInfo ) {
        return parentChildrenInfo.parentInfo.occurrenceId;
    } );

    return _.filter( rootPathNodes, function( rootPathNode ) {
        return allParents.indexOf( rootPathNode.id ) === -1;
    } );
}

var setExpansionStateForNode = function( treeLoadInput, vmNode, declViewModel, dataProvider, expandBelowModeState ) {
    if( vmNode.$$treeLevel >= treeLoadInput.levelsApplicableForExpansion ) {
        var vmoIndex = dataProvider.viewModelCollection.findViewModelObjectById( vmNode.uid );
        var node = dataProvider.viewModelCollection.getViewModelObject( vmoIndex );
        //Restoring nodes from collapseCache on Expand Below/Expand To Level is done in
        //in expand below service itself now. This code is not needed in that case
        // if( !node ) {
        //     var nodeFoundInCache = _.find( expandBelowModeState.parentsToLookInto, function( cachedNode ) {
        //         return cachedNode.uid === vmNode.uid;
        //     } );
        //     if( nodeFoundInCache && !nodeFoundInCache.isLeaf && nodeFoundInCache.__expandState ) {
        //         vmNode.__expandState = nodeFoundInCache.__expandState;
        //         node = nodeFoundInCache;
        //     }
        // }
        aceExpandBelowService.collapseNodeHierarchy( {
            data: declViewModel,
            row: node ? node : vmNode
        } );
    } else {
        _.assign( vmNode, expandBelowModeState );
        occmgmtTreeTableStateService.addNodeToExpansionState( vmNode, declViewModel );
    }
};

/**
 *
 * @param {TreeLoadInput} treeLoadInput TreeLoadInput
 * @param {*} treeLoadOutput VMTreeNodes
 * @param {*} declViewModel declarative viewModel
 * @param {*} expandBelowModeState Flags to Assign
 */
function _updateVMNodesWithChildrenAndCountInformation( treeLoadInput, treeLoadOutput, declViewModel, expandBelowModeState ) {
    var vmNodesInTreeHierarchyLevels = treeLoadOutput.vmNodesInTreeHierarchyLevels;
    var dataProvider = occmgmtUtils.getCurrentTreeDataProvider( declViewModel.dataProviders );
    for( var ndx = 0; ndx < vmNodesInTreeHierarchyLevels.length; ndx++ ) {
        for( var cdx = 0; cdx < vmNodesInTreeHierarchyLevels[ ndx ].length; cdx++ ) {
            var viewModelTreeNode = vmNodesInTreeHierarchyLevels[ ndx ][ cdx ];
            if( !viewModelTreeNode.isLeaf ) {
                var children = getVMNodeChildren( vmNodesInTreeHierarchyLevels, viewModelTreeNode.uid );
                if( children && children.length > 0 ) {
                    viewModelTreeNode.children = _.clone( children );
                    viewModelTreeNode.isExpanded = true;
                    viewModelTreeNode.totalChildCount = children.length;
                } else if( !_.isEmpty( expandBelowModeState ) ) {
                    setExpansionStateForNode( treeLoadInput, vmNodesInTreeHierarchyLevels[ ndx ][ cdx ], declViewModel, dataProvider, expandBelowModeState );
                }
            }
        }
    }
}

/**
 * populates ViewModelTreeNodes
 * @param {treeLoadInput} TreeLoadInput
 * @param {treeLoadOutput} TreeLoadOutput
 * @param {response} GetOccurrences response
 * @param {declViewModel} decl ViewModel
 * @param {contextState} Context State
 * @returns View Model Tree Nodes
 */
function _populateViewModelTreesNodesInTreeHierarchyFormatForTopDown( treeLoadInput, treeLoadOutput, response, declViewModel, contextState ) {
    var vmNodesInTreeHierarchyLevels = treeLoadOutput.vmNodesInTreeHierarchyLevels;
    var dataProvider = occmgmtUtils.getCurrentTreeDataProvider( declViewModel.dataProviders );
    let vmNodes = undefined;
    /*
     *   Populate Parent VM Node
     */
    if( treeLoadOutput.mergeNewNodesInCurrentlyLoadedTree ) {
        var parentNodeIndex = dataProvider.viewModelCollection.findViewModelObjectById( response.parentOccurrence.occurrenceId );

        if( parentNodeIndex !== -1 ) {
            var parentNode = _.assign( {}, dataProvider.viewModelCollection.getViewModelObject( parentNodeIndex ) );
            vmNodesInTreeHierarchyLevels.push( [ parentNode ] );
        }
    } else {
        var placeHolderParentsInRootPathNodes = _findPlaceHolderParentsInRootPathNodes( response.parentChildrenInfos, treeLoadOutput.rootPathNodes );

        //topNode to be added in vmNodesInTreeHierarchyLevels here for correct indentation and processing of data.
        if( treeLoadOutput.showTopNode ) {
            vmNodesInTreeHierarchyLevels.push( [ treeLoadOutput.rootPathNodes[ 1 ] ] );
        }

        // Build levels of placeholder parents
        for( var ndx = 1; ndx < placeHolderParentsInRootPathNodes.length; ndx++ ) {
            vmNodesInTreeHierarchyLevels.push( [ treeLoadOutput.rootPathNodes[ ndx ] ] );
        }

        // The parent object in first parentChildrenInfos is the child of the last root path node. So insert it in vmNodesInTreeHierarchyLevels.
        if( placeHolderParentsInRootPathNodes.length > 0 ) {
            var parentModelObject = cdmSvc.getObject( response.parentChildrenInfos[ 0 ].parentInfo.occurrenceId );
            var vmNodeLevelIndex = getVMNodeLevelIndex( treeLoadOutput, response.parentChildrenInfos, parentModelObject );
            var firstLoadedParentNode = occmgmtVMTNodeCreateService.createVMNodeUsingModelObjectInfo( parentModelObject, 0, vmNodeLevelIndex, treeLoadOutput.vmNodeCreationStrategy );
            firstLoadedParentNode.isPlaceholder = true;
            vmNodesInTreeHierarchyLevels.push( [ firstLoadedParentNode ] );
        }

        // We do not need rootPathNodes for further processing. Retaining those will lead to a different code path and hence we need to get rid of those
        delete treeLoadOutput.rootPathNodes;
    }

    /*
     * Populate VM Node tree hierarchy for all Children
     */
    var uidToLevelMap = new Map();
    var parentNodeOut = _.last( treeLoadOutput.vmNodesInTreeHierarchyLevels );
    if( parentNodeOut ) {
        uidToLevelMap.set( _.last( parentNodeOut ).uid, _.last( parentNodeOut ).$$treeLevel );
    }
    for( ndx = 0; ndx < response.parentChildrenInfos.length; ndx++ ) {
        let parentChildInfo = response.parentChildrenInfos[ ndx ];

        let parentUid = parentChildInfo.parentInfo.occurrenceId;
        let parentLevel = treeLoadOutput.showTopNode ? 0 : -1;
        if( uidToLevelMap.has( parentUid ) ) {
            parentLevel = uidToLevelMap.get( parentUid );
        } else {
            parentLevel = getVMNodeLevelIndexByTraversingParentInCdm( treeLoadOutput.showTopNode, parentUid );
        }

        let childLevel = parentLevel + 1;
        if( parentChildInfo.childrenInfo.length ) {
            for( let childIndex = 0; childIndex < parentChildInfo.childrenInfo.length; ++childIndex ) {
                if( parentChildInfo.childrenInfo[ childIndex ].numberOfChildren > 0 ) {
                    uidToLevelMap.set( parentChildInfo.childrenInfo[ childIndex ].occurrenceId, childLevel );
                }
            }

            //third input parameter should be response.rootProductContext.uid ?. applicable for all getOcc callers? Will update when needed
            vmNodes = occmgmtVMTNodeCreateService.createVMNodesForGivenOccurrences( parentChildInfo.childrenInfo, childLevel, treeLoadOutput.currentState.pci_uid, treeLoadOutput.elementToPCIMap,
                parentChildInfo.parentInfo.occurrenceId, treeLoadInput, treeLoadOutput.vmNodeCreationStrategy );
            _updateVMNodesWithIncompleteHeadTailInfo( parentChildInfo.cursor, vmNodes );
            vmNodesInTreeHierarchyLevels.push( vmNodes );
            vmNodeLevelIndex = childLevel;
        }
    }

    treeLoadOutput.vmNodesInTreeHierarchyLevels = vmNodesInTreeHierarchyLevels;

    if( vmNodeLevelIndex === 0 ) {
        delete treeLoadOutput.vmNodesInTreeHierarchyLevels;
        delete treeLoadOutput.nonRootPathHierarchicalData;
    }

    return vmNodes;
}

var getVMNodeChildren = function( vmNodesInTreeHierarchyLevels, uid ) {
    for( var ndx = 0; ndx < vmNodesInTreeHierarchyLevels.length; ndx++ ) {
        for( var cdx = 0; cdx < vmNodesInTreeHierarchyLevels[ ndx ].length; cdx++ ) {
            if( vmNodesInTreeHierarchyLevels[ ndx ][ cdx ].parentUid === uid ) {
                return vmNodesInTreeHierarchyLevels[ ndx ];
            }
        }
    }

    return [];
};

var exports = {};

/**
 */
const _getCursorObjectForInputParentNode = ( response, parentUid ) => {
    var cursorObject = response.cursor;
    if( !_.isEmpty( response.parentChildrenInfos ) ) {
        for( let i = 0; i < response.parentChildrenInfos.length; i++ ) {
            if( _.isEqual( response.parentChildrenInfos[ i ].parentInfo.occurrenceId, parentUid ) ) {
                cursorObject = response.parentChildrenInfos[ i ].cursor;
                break;
            }
        }
    }

    return cursorObject;
};

const _buildTreeLoadOutputForFocusAction = ( treeLoadOutput, declViewModel, response, treeLoadInput ) => {
    treeLoadOutput.rootPathNodes = _buildRootPathNodes( treeLoadInput.subPanelContext, treeLoadOutput, response );

    //Server returned multiple levels. Merge will happen if parent this path is present in loaded structure.
    let vmNodes = _populateViewModelTreesNodesInTreeHierarchyFormat( treeLoadOutput, response, treeLoadInput );
    _populateMergeNewNodesInCurrentyLoadedTreeParameter( treeLoadOutput, declViewModel, response );

    return vmNodes;
};

const updateOccContextValueWithProvidedInput = ( treeLoadOutput, occContextValue, valuesToCopyOrUpdateOccContext, valuesToResetAfterAction, copyDefaultValue ) => {
    if( valuesToCopyOrUpdateOccContext ) {
        _.forEach( valuesToCopyOrUpdateOccContext, function( value, name ) {
            //Structures might not come with every initializeAction response. like displayToggleOptions.
            //We need to retain existing ones in that case.
            if( !_.isNull( treeLoadOutput[ name ] ) && !_.isEmpty( treeLoadOutput[ name ] ) || _.isBoolean( treeLoadOutput[ name ] ) || _.isNumber( treeLoadOutput[ name ] ) ) {
                occContextValue[ name ] = treeLoadOutput[ name ];
            } else {
                if( copyDefaultValue ) {
                    occContextValue[ name ] = valuesToCopyOrUpdateOccContext[ name ];
                }
            }
        } );
    }

    if( valuesToResetAfterAction ) {
        _.forEach( valuesToResetAfterAction, function( value, name ) {
            occContextValue[ name ] = value;
        } );
    }
};

let _updateGlobalStateInformation = function( treeLoadOutput, finalOccContextValue, viewKey ) {
    //elementToPCIMapCount: 0,
    //selectedModelObjects: {}, ( cleanup?)
    //showTopNode: true, ( cleanup?)
    //vmc: {},
    //treeDataProvider: {},
    //isRestoreOptionApplicableForProduct: false,
    //defaultOpenStateMessageTime: {},
    //defaultOpenStateMessage: {},
    // "ctx.occmgmtContext.modelObject": "result.treeLoadResult.baseModelObject",
    // "ctx.occmgmtContext.productContextInfo": "result.treeLoadResult.productContextInfo",
    // "ctx.occmgmtContext.serializedRevRule": "result.treeLoadResult.serializedRevRule",
    // "ctx.occmgmtContext.openedElement": "result.treeLoadResult.openedModelObject",
    // "ctx.occmgmtContext.topElement": "result.treeLoadResult.topModelObject",
    // "ctx.occmgmtContext.sublocationAttributes": "result.treeLoadResult.sublocationAttributes",
    // "ctx.occmgmtContext.autoSavedSessiontime": "result.treeLoadResult.autoSavedSessiontime",
    // "ctx.occmgmtContext.searchFilterCategories": "result.treeLoadResult.filter.searchFilterCategories",
    // "ctx.occmgmtContext.searchFilterMap": "result.treeLoadResult.filter.searchFilterMap",
    // "ctx.occmgmtContext.recipe": "result.treeLoadResult.filter.recipe",
    // "ctx.occmgmtContext.sourceContextToInfoMap": "result.treeLoadResult.sourceContextToInfoMap",
    // "ctx.occmgmtContext.requestPref": "result.treeLoadResult.requestPref",
    // "ctx.occmgmtContext.configContext": "result.treeLoadResult.configContext",
    // "ctx.occmgmtContext.startFreshNavigation": "result.treeLoadResult.startFreshNavigation",
    // "ctx.occmgmtContext.elementToPCIMap": "result.treeLoadResult.elementToPCIMap",
    // "ctx.occmgmtContext.vmc": "result.treeLoadResult.vmc",
    // "ctx.occmgmtContext.treeDataProvider": "result.treeLoadResult.treeDataProvider",
    // "ctx.occmgmtContext.isChangeEnabled": "result.treeLoadResult.isChangeEnabled",
    // "ctx.occmgmtContext.sublocation.clientScopeURI":"result.treeLoadResult.productContextInfo.props.awb0ClientScopeUri.dbValues[0]",

    let valuesToCopyOrUpdateOnCtxFinal = {
        modelObject: treeLoadOutput.baseModelObject,
        productContextInfo: {}, //"result.treeLoadResult.productContextInfo",
        serializedRevRule: undefined, //"result.treeLoadResult.serializedRevRule",
        openedElement: {}, //"result.treeLoadResult.openedModelObject",
        topElement: {}, //"result.treeLoadResult.topModelObject",
        sublocationAttributes: {}, //"result.treeLoadResult.sublocationAttributes",
        autoSavedSessiontime: {}, //"result.treeLoadResult.autoSavedSessiontime",
        searchFilterCategories: [], //"result.treeLoadResult.filter.searchFilterCategories",
        searchFilterMap: undefined, //"result.treeLoadResult.filter.searchFilterMap",
        recipe: [], //"result.treeLoadResult.filter.recipe",
        //sourceContextToInfoMap:{}, //"result.treeLoadResult.sourceContextToInfoMap", This is going on atomic data
        requestPref: {}, //"result.treeLoadResult.requestPref",
        configContext: {}, //"result.treeLoadResult.configContext",
        startFreshNavigation: {}, //"result.treeLoadResult.startFreshNavigation",
        elementToPCIMapCount: 0,
        elementToPCIMap: undefined, //"result.treeLoadResult.elementToPCIMap",
        vmc: {}, //"result.treeLoadResult.vmc",
        treeDataProvider: {}, //"result.treeLoadResult.treeDataProvider",
        supportedFeatures: {},
        readOnlyFeatures: {},
        isOpenedUnderAContext: {},
        workingContextObj: null,
        currentState: {},
        previousState: {},
        isChangeEnabled: undefined, //"result.treeLoadResult.isChangeEnabled",
        sublocation: {
            clientScopeURI: treeLoadOutput.productContextInfo.props.awb0ClientScopeUri ? treeLoadOutput.productContextInfo.props.awb0ClientScopeUri.dbValues[ 0 ] : ''
        }
    };

    let valuesToCopyOrUpdateOnCtx = {
        configContext: {},
        startFreshNavigation: false,
        requestPref: {},
        vmc: {},
        treeDataProvider: {},
        previousState: {},
        currentState: {}
    };
    let currentContextValue = {};
    updateOccContextValueWithProvidedInput( treeLoadOutput, currentContextValue, valuesToCopyOrUpdateOnCtx, undefined, true );
    occmgmtUtils.updateValueOnCtxOrState( '', currentContextValue, viewKey );
};

//"ctx.locationContext.modelObject"
//"ctx.objectQuotaContext.useObjectQuota"
//"ctx.isRedLineMode"
//"ctx.changeContext"
//"ctx.occmgmtContext.modelObject"
//"ctx.occmgmtContext.sublocationAttributes"
//"ctx.occmgmtContext.autoSavedSessiontime"
//"ctx.occmgmtContext.searchFilterCategories"
//"ctx.occmgmtContext.searchFilterMap"
//"ctx.occmgmtContext.recipe"
//"ctx.occmgmtContext.sourceContextToInfoMap"
//"ctx.occmgmtContext.requestPref"
//"ctx.occmgmtContext.configContext"  --> on atomic data
//"ctx.occmgmtContext.startFreshNavigation" --> cleanup candidate. should be on transientRequestPref
//"ctx.occmgmtContext.elementToPCIMap" -->on atomic data
//"ctx.occmgmtContext.vmc"
//"ctx.occmgmtContext.treeDataProvider"
//"ctx.occmgmtContext.isChangeEnabled"
//"ctx.decoratorToggle"
/**
 */
const _buildTreeLoadOutputForInitializeAction = ( treeLoadInput, treeLoadOutput, declViewModel, response, contextState, uwDataProvider, subPanelContext ) => {
    treeLoadOutput.supportedFeatures = occmgmtStateHandler.getSupportedFeaturesFromPCI( treeLoadOutput.productContextInfo );
    treeLoadOutput.readOnlyFeatures = occmgmtStateHandler.getReadOnlyFeaturesFromPCI( treeLoadOutput.productContextInfo );
    treeLoadOutput.workingContextObj = occmgmtUtils.getSavedWorkingContext( treeLoadOutput.productContextInfo );

    var disabledFeatures = subPanelContext.occContext.disabledFeatures; //Features that server supports but not enabled on client side.
    for( let i = 0; i < disabledFeatures.length; i++ ) {
        if( treeLoadOutput.supportedFeatures.hasOwnProperty( disabledFeatures[ i ] ) ) {
            delete treeLoadOutput.supportedFeatures[ disabledFeatures[ i ] ];
        }
    }

    treeLoadOutput.isOpenedUnderAContext = treeLoadOutput.workingContextObj !== null;
    treeLoadOutput.mergeNewNodesInCurrentlyLoadedTree = false;

    //vmc population is one time thing
    if( declViewModel && declViewModel.dataProviders ) {
        treeLoadOutput.treeDataProvider = occmgmtUtils.getCurrentTreeDataProvider( declViewModel.dataProviders );
        treeLoadOutput.vmc = treeLoadOutput.treeDataProvider.vmCollectionObj.vmCollection;
    }

    _updateTopNodeRelatedInformationInOutputStructure( treeLoadInput, treeLoadOutput, response );
    //LCS-582687: Color filtering should not be true if Awb0ColorFilteringFeature is not returned in PCI
    _updateColorToggleRelatedInfo( treeLoadOutput );
    setAutoSavedSessiontime( treeLoadInput.isProductInteracted, contextState, treeLoadOutput, response );

    occmgmtGetOccsResponseService.populateRequestPrefInfoOnOccmgmtContext( treeLoadOutput, response, contextState.occContext );
    occmgmtGetOccsResponseService.populateFeaturesInfoOnOccmgmtContext( treeLoadOutput, response, contextState.key );
    occmgmtGetOccsResponseService.populateSourceContextToInfoMapOnOccmgmtContext( treeLoadOutput, response );

    treeLoadOutput.isRestoreOptionApplicableForProduct = aceRestoreBWCStateService.addOpenedProductToSessionStorage( treeLoadInput, treeLoadOutput, uwDataProvider, subPanelContext );
};

const _buildOccContextValueFromTreeLoadOutputOnInitializeAction = ( treeLoadOutput, occContextValue ) => {
    let valuesToCopyOrUpdateOccContext = {
        displayToggleOptions: {},
        supportedFeatures: {},
        readOnlyFeatures: {},
        productContextInfo: {},
        searchFilterMap: {},
        searchFilterCategories: {},
        elementToPCIMap: {},
        elementToPCIMapCount: 0,
        selectedModelObjects: {},
        pwaSelection: {},
        tabNameToActivate: {},
        isOpenedUnderAContext: {},
        workingContextObj: {},
        topElement: {},
        openedElement: {},
        currentState: {},
        previousState: {},
        showTopNode: true,
        vmc: {},
        treeDataProvider: {},
        isRestoreOptionApplicableForProduct: false,
        defaultOpenStateMessageTime: {},
        defaultOpenStateMessage: {},
        baseModelObject: {},
        persistentRequestPref: {},
        AceHeaderForApplication: '',
        sourceContextToInfoMap: {}
    };
    let onPwaLoadComplete = occContextValue.onPwaLoadComplete ? occContextValue.onPwaLoadComplete : 0;
    let valuesToResetAfterInitializeAction = {
        configContext: {},
        disabledFeatures: [],
        transientRequestPref: {},
        onPwaLoadComplete: onPwaLoadComplete + 1,
        pwaReset: undefined
    };

    updateOccContextValueWithProvidedInput( treeLoadOutput, occContextValue, valuesToCopyOrUpdateOccContext, valuesToResetAfterInitializeAction );
};

/**
 * @param {*} treeLoadInput TreeLoadInput
 * @param {*} treeLoadOutput TreeLoadOutput
 * @param {*} declViewModel Tree Decl ViewModel
 * @param {*} response GetOccurrences() response
 * @param {*} contextState context state
 * @param {*} uwDataProvider Tree Data ProviderSt
 * @param {*} occContextValue OccContextValue
 * @param {*} finalOccContextValue final occContextValue to be updated on atomic data
 * @return {*} array of arrays of ViewModelTreeNode
 */
function _buildResponseForInitializeAction( treeLoadInput, treeLoadOutput, declViewModel, response, contextState, uwDataProvider, occContextValue, finalOccContextValue ) {
    let skipActiveTabUpdate = occContextValue.transientRequestPref.skipActiveTabUpdate;
    _buildTreeLoadOutputForInitializeAction( treeLoadInput, treeLoadOutput, declViewModel, response, contextState, uwDataProvider, treeLoadInput.subPanelContext );
    _buildOccContextValueFromTreeLoadOutputOnInitializeAction( treeLoadOutput, occContextValue );

    finalOccContextValue = occContextValue;

    //Code to update secondaryActiveTabId using atomic data...
    // Tab value seen correctly in AFX code. But it didn't work. Need to check with CFX team.
    var sublocationState = treeLoadInput.subPanelContext.pageContext.sublocationState;
    var swaContext = { ...sublocationState.value };

    //Action that wants to honor server tab, should set honorActiveTabIdFromServer to true
    //Going forward, Reset & Restore should also use honorActiveTabIdFromServer approach to specify that they would honor active tab from server.
    if( !skipActiveTabUpdate ) {
        swaContext.secondaryActiveTabId = treeLoadOutput.tabNameToActivate;
        let spageId = awStateService.instance.params[ contextState.urlParams.secondaryPageIdQueryParamKey ];
        swaContext.secondaryActiveTabId = spageId && !treeLoadInput.isResetRequest && !contextState.context.restoreProduct ? spageId : treeLoadOutput.tabNameToActivate;
        !_.isUndefined( swaContext.secondaryActiveTabId ) ? occmgmtUtils.updateValueOnCtxOrState( '', swaContext, sublocationState ) : null;
    }

    // Also update occContext field
    if( !_.isUndefined( finalOccContextValue.currentState ) && finalOccContextValue.currentState.spageId !== swaContext.secondaryActiveTabId ) {
        finalOccContextValue.currentState.spageId = swaContext.secondaryActiveTabId;
    }
    return finalOccContextValue;
}

/**
 *
 * @param {*} occContextValue OccContextValue
 * @param {*} treeLoadOutput TreeLoadOutput
 * @param {*} finalOccContextValue final occContextValue to be updated on atomic data
 */
function _buildResponseForPreviousAction( occContextValue, treeLoadOutput, finalOccContextValue ) {
    let onPwaLoadComplete = occContextValue.onPwaLoadComplete ? occContextValue.onPwaLoadComplete : 0;

    let valuesToResetAfterPreviousAction = {
        configContext: {},
        onPwaLoadComplete: onPwaLoadComplete + 1,
        pwaReset: undefined,
        isRestoreOptionApplicableForProduct: false,
        transientRequestPref: {}
    };
    updateOccContextValueWithProvidedInput( treeLoadOutput, finalOccContextValue, undefined, valuesToResetAfterPreviousAction );
}

/**
 * @param {*} treeLoadOutput TreeLoadOutput
 * @param {*} treeLoadInput TreeLoadInput
 * @param {*} uwDataProvider Tree Data ProviderSt
 * @param {*} vmNodeStates State to be added on VMNode during creation
 * @param {*} response GetOccurrences() response
 * @param {*} vmNodes VMNodes if already created
 * @param {*} declViewModel Tree Decl ViewModel
 * @param {*} contextState context state
 * @param {*} occContextValue OccContextValue
 * @param {*} finalOccContextValue final occContextValue to be updated on atomic data
 * @return {*} array of arrays of ViewModelTreeNode
 */
function _buildResponseForNextAction( treeLoadOutput, treeLoadInput, uwDataProvider, vmNodeStates, response, vmNodes, declViewModel, contextState, occContextValue, finalOccContextValue ) {
    treeLoadOutput.mergeNewNodesInCurrentlyLoadedTree = true;
    // TODO : Below line can be removed once product will be added to sessionStorage on command interaction.
    // In Angular, we were listening to 'aw-command-logEvent'event. its not fired in BA.
    treeLoadOutput.isRestoreOptionApplicableForProduct = aceRestoreBWCStateService.addOpenedProductToSessionStorage( treeLoadInput, treeLoadOutput, uwDataProvider, treeLoadInput.subPanelContext );

    if( treeLoadInput.expandBelow ) {
        _updateNewTopNodeRelatedInformation( treeLoadInput, treeLoadOutput );
        vmNodeStates.isInExpandBelowMode = true;
    } else {
        treeLoadOutput.vmNodesInTreeHierarchyLevels = [];
        _buildRootPathNodes( treeLoadInput.subPanelContext, treeLoadOutput, response );
        vmNodes = _populateViewModelTreesNodesInTreeHierarchyFormatForTopDown( treeLoadInput, treeLoadOutput, response, declViewModel, contextState );

        //need to try uncommenting below.next action, except expand below, wont have hierarchial data
        //delete treeLoadOutput.nonRootPathHierarchicalData;
        delete treeLoadOutput.vmNodesInTreeHierarchyLevels;
        delete treeLoadOutput.rootPathNodes;
    }
    //"ctx.occmgmtContext.elementToPCIMap"  should be part focusAction now.
    //"ctx.occmgmtContext.productContextInfo" should be part focusAction now.
    //"ctx.occmgmtContext.recipe"
    //"ctx.occmgmtContext.requestPref"
    //_buildTreeLoadOutputForNextAction();
    let onPwaLoadComplete = occContextValue.onPwaLoadComplete ? occContextValue.onPwaLoadComplete : 0;
    let valuesToResetAfterNextAction = {
        configContext: {},
        onPwaLoadComplete: onPwaLoadComplete + 1,
        pwaReset: undefined,
        isRestoreOptionApplicableForProduct: false,
        transientRequestPref: {}
    };
    let valuesToCopyOrUpdateOccContext = undefined;
    if( occContextValue.transientRequestPref.nodeToExpandAfterFocus ) {
        //reimposing existing selections if nodeToExpandAfterFocus is present ( )
        valuesToCopyOrUpdateOccContext = {
            selectedModelObjects: {},
            pwaSelection: {}
        };
    }
    updateOccContextValueWithProvidedInput( treeLoadOutput, finalOccContextValue, valuesToCopyOrUpdateOccContext, valuesToResetAfterNextAction );
    return vmNodes;
}

/**
 * @param {*} occContextValue OccContextValue
 * @param {*} vmNodes VMNodes if already created
 * @param {*} treeLoadOutput TreeLoadOutput
 * @param {*} declViewModel Tree Decl ViewModel
 * @param {*} response GetOccurrences() response
 * @param {*} treeLoadInput TreeLoadInput
 * @param {*} finalOccContextValue final occContextValue to be updated on atomic data
 * @return {*} array of arrays of ViewModelTreeNode
 */
function _buildResponseForFocusAction( occContextValue, vmNodes, treeLoadOutput, declViewModel, response, treeLoadInput, finalOccContextValue ) {
    treeLoadOutput.supportedFeatures = occmgmtStateHandler.getSupportedFeaturesFromPCI( treeLoadOutput.productContextInfo );
    treeLoadOutput.readOnlyFeatures = occmgmtStateHandler.getReadOnlyFeaturesFromPCI( treeLoadOutput.productContextInfo );
    let onPwaLoadComplete = occContextValue.onPwaLoadComplete ? occContextValue.onPwaLoadComplete : 0;
    let valuesToResetAfterFocusAction = {
        configContext: {},
        onPwaLoadComplete: onPwaLoadComplete + 1,
        pwaReset: undefined,
        isRestoreOptionApplicableForProduct: false,
        transientRequestPref: {},
        selectionsToModify:{}
    };
    let valuesToCopyOrUpdateOccContext = {
        selectedModelObjects: {},
        pwaSelection: {},
        currentState: {},
        productContextInfo: {},
        elementToPCIMap: {},
        elementToPCIMapCount: 0,
        nodeToExpandAfterFocus: {},
        supportedFeatures: {},
        readOnlyFeatures: {}
    };
    vmNodes = _buildTreeLoadOutputForFocusAction( treeLoadOutput, declViewModel, response, treeLoadInput );
    updateOccContextValueWithProvidedInput( treeLoadOutput, finalOccContextValue, valuesToCopyOrUpdateOccContext, valuesToResetAfterFocusAction );
    return vmNodes;
}

let _populateObjectsToSelectInfo = function( newState, treeLoadOutput ) {
    let selectedObj = cdmSvc.getObject( newState.c_uid );
    if( selectedObj ) {
        treeLoadOutput.selectedModelObjects = [ selectedObj ];
        treeLoadOutput.pwaSelection = [ selectedObj ];
    } else {
        treeLoadOutput.selectedModelObjects = [];
        treeLoadOutput.pwaSelection = [ selectedObj ];
    }
};

/**
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {ISOAResponse} response - SOA Response
 *
 * @return {TreeLoadResult} A new TreeLoadResult object containing result/status information.
 */
export let processGetOccurrencesResponse = function( treeLoadInput, response, contextState, declViewModel, uwDataProvider, soaInput ) {
    let occContext = treeLoadInput.subPanelContext.occContext;
    let occContextValue = contextState.occContext;
    let treeLoadOutput = {
        displayToggleOptions: {},
        configContext: {},
        supportedFeatures: {},
        readOnlyFeatures: {},
        selectedModelObjects: []
    };

    let parentNode = treeLoadInput.parentNode;
    let isTopNode = parentNode.levelNdx === -1;
    let cursorObject = _getCursorObjectForInputParentNode( response, treeLoadInput.parentNode.uid );
    //Child Level should be parent level plus one.
    let childOccsCreationLevelNdx = treeLoadInput.parentNode.levelNdx + 1;
    treeLoadOutput.occurrences = response.occurrences;

    let treeLoadResult;
    let vmNodes = {};
    let newState = occmgmtGetOccsResponseService.getNewStateFromGetOccResponse( response, contextState, soaInput );
    let syncState = contextStateMgmtService.createSyncState( contextState.occContext, newState );
    let finalOccContextValue = {};
    let vmNodeStates = {};

    treeLoadOutput.currentState = syncState.currentState;
    treeLoadOutput.previousState = syncState.previousState;
    _buildTreeLoadOutputInfo( treeLoadInput, treeLoadOutput, response, newState, contextState, occContextValue );

    /**
     * Build reuse VMNode strategy in case of delta response.
     * reuseVMNode = true ==> When we get delta response, we try to re-use view model nodes as they are not changed.
     * clearExpandState = true ==> The collapse cache may be invalid after config change.
     * staleVMNodeUids = [] ==> Array of VMNodes which are updated at server and its properties needs reevaluation.
     */
    if( response.requestPref && response.requestPref.deltaTreeResponse &&
        response.requestPref.deltaTreeResponse[ 0 ].toLowerCase() === 'true' && !_.isUndefined( contextState.context.vmc ) ) {
        treeLoadOutput.vmNodeCreationStrategy = {
            reuseVMNode: true,
            clearExpandState: true,
            staleVMNodeUids: []
        };

        // LCS-698825 -When we have large number of updated objects servicedata is bloated
        // mark updated objects as stale and rely on getTableViewModelProperties to fetch columns properties.
        if( !_.isUndefined( response.requestPref.updatedObjectUids ) ) {
            treeLoadOutput.vmNodeCreationStrategy.staleVMNodeUids = response.requestPref.updatedObjectUids;
        }
    }

    // if we know we are going to reuse the VMNode then create a mapping of uids to VMO for performance purpose.
    if( !_.isUndefined( treeLoadOutput.vmNodeCreationStrategy ) && treeLoadOutput.vmNodeCreationStrategy.reuseVMNode ) {
        var loadVMObjectUidsMap = new Map();
        _.forEach( contextState.context.vmc.loadedVMObjects, function( loadedVMObject ) {
            loadVMObjectUidsMap.set( loadedVMObject.uid, loadedVMObject );
        } );
        treeLoadOutput.vmNodeCreationStrategy.referenceLoadedVMObjectUidsMap = loadVMObjectUidsMap;
    }

    _populateObjectsToSelectInfo( newState, treeLoadOutput );

    //updates 28 ctx params at this point
    if( _.isEqual( treeLoadInput.dataProviderActionType, 'initializeAction' ) ) {
        finalOccContextValue = _buildResponseForInitializeAction( treeLoadInput, treeLoadOutput, declViewModel, response, contextState, uwDataProvider, occContextValue, finalOccContextValue );

        //Case of empty structure and we want to show TopNode in UI. Happens only in initializeAction.
        if( !_.isEmpty( treeLoadOutput.topNodeOccurrence ) ) {
            vmNodes = occmgmtVMTNodeCreateService.createVMNodesForGivenOccurrences( treeLoadOutput.topNodeOccurrence, childOccsCreationLevelNdx,
                newState.pci_uid, treeLoadOutput.elementToPCIMap, null, treeLoadInput, treeLoadInput.vmNodeCreationStrategy );
        } else {
            // To support jitter free tree display upon configuration and filter change, build rootPathNodes
            // with first parent in parentChildrenInfos in getOcc SOA  response.
            if( _.isUndefined( treeLoadOutput.rootPathNodes ) && !_.isEmpty( response.parentChildrenInfos ) ) {
                var occurrenceId = response.parentChildrenInfos[ 0 ].parentInfo.occurrenceId;
                _buildRootPathNodes( treeLoadInput.subPanelContext, treeLoadOutput, response, occurrenceId );
            }
        }
        finalOccContextValue.lastDpAction = 'initializeAction';

        if( response.reloadSWANeeded ) {
            finalOccContextValue.lastDpAction = 'initializeActionWithDeltaResponseTrueWithNoChange';
        }
    }
    if( _.isEqual( treeLoadInput.dataProviderActionType, 'focusAction' ) || treeLoadInput.focusLoadAction === true ) {
        /*
         isTopNode condition below is cleanup candidate. Currently it performs sync selection.
         For focus case, sync selection is not needed. Its already done prior to focusAction call.
         */
        isTopNode = false;
        vmNodes = _buildResponseForFocusAction( occContextValue, vmNodes, treeLoadOutput, declViewModel, response, treeLoadInput, finalOccContextValue );
        finalOccContextValue.lastDpAction = 'focusAction';
    }
    if( _.isEqual( treeLoadInput.dataProviderActionType, 'nextAction' ) && treeLoadInput.focusLoadAction !== true ) {
        //For expand below, actionType is 'nextAction'.
        vmNodes = _buildResponseForNextAction( treeLoadOutput, treeLoadInput, uwDataProvider, vmNodeStates, response, vmNodes, declViewModel, contextState, occContextValue, finalOccContextValue );
        finalOccContextValue.lastDpAction = 'nextAction';
    }
    if( _.isEqual( treeLoadInput.dataProviderActionType, 'previousAction' ) ) {
        //"ctx.occmgmtContext.recipe":
        //"ctx.occmgmtContext.requestPref"
        //_buildTreeLoadOutputForPreviousAction() );
        _buildResponseForPreviousAction( occContextValue, treeLoadOutput, finalOccContextValue );
        finalOccContextValue.lastDpAction = 'previousAction';
    }
    if( response.requestPref && response.requestPref.deltaTreeResponse &&
        response.requestPref.deltaTreeResponse[ 0 ].toLowerCase() === 'true' && !_.isUndefined( contextState.context.vmc ) ) {
        // mark deleted objects expansion state in local storage as collapse.
        var vmNodesMarkedForDeletion = _.filter( contextState.context.vmc.loadedVMObjects, function( vmNode ) {
            return vmNode.markForDeletion;
        } );
        var gridId = Object.keys( declViewModel.grids )[ 0 ];
        _.forEach( vmNodesMarkedForDeletion, function( vmNodeToBeDeleted ) {
            if( vmNodeToBeDeleted && vmNodeToBeDeleted.isExpanded ) {
                awTableStateService.saveRowCollapsed( declViewModel, gridId, vmNodeToBeDeleted );
                delete vmNodeToBeDeleted.isExpanded;
            }
        } );
    }

    if( _.isEmpty( vmNodes ) ) {
        vmNodes = _createChildOccurrences( treeLoadInput, treeLoadOutput, response, newState, declViewModel, contextState, childOccsCreationLevelNdx, vmNodeStates, isTopNode );
    }

    if( response.requestPref && response.requestPref.ignoreIndexForPCIs ) {
        finalOccContextValue.persistentRequestPref.ignoreIndexForPCIs = response.requestPref.ignoreIndexForPCIs;
    }

    /**
     * Create occs and a basic treeLoadResult
     */
    treeLoadResult = awTableSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, cursorObject.startReached, cursorObject.endReached, treeLoadOutput.newTopNode );

    if( _.isEqual( treeLoadInput.dataProviderActionType, 'initializeAction' ) ) {
        _updateGlobalStateInformation( treeLoadOutput, finalOccContextValue, occContext.viewKey );
    }

    occmgmtUtils.updateValueOnCtxOrState( '', finalOccContextValue, occContext );

    //kulkaamo: Below code that was needed for selection sync trigger. not needed in BA ( cleanup caused one regression)
    if( isTopNode ) {
        /**
         * Remove the 'c_uid' property since these are normally controlled by the sublocation.
         */
        // if( treeLoadInput.skipFocusOccurrenceCheck && contextState.occContext.previousState.c_uid ) {
        //     delete newState.c_uid;
        //     delete newState.o_uid;
        // }
        // contextStateMgmtService.syncContextState( contextState.occContext.viewKey, newState );
    }

    _.forEach( treeLoadOutput, function( value, name ) {
        if( !_.isUndefined( value ) ) {
            treeLoadResult[ name ] = value;
        }
    } );

    treeLoadResult.parentNode.cursorObject = cursorObject;
    return treeLoadResult;
};

export default exports = {
    processGetOccurrencesResponse
};
