/* eslint-disable no-console */
// Copyright (c) 2022 Siemens

/**
 * @module js/invoker/occurrencesLoader
 */

import appCtxSvc from 'js/appCtxService';
import awTableSvc from 'js/awTableService';
import cdmSvc from 'soa/kernel/clientDataModel';
import occmgmtIconService from 'js/occmgmtIconService';

/**
 * @param {SoaOccurrenceInfo} occInfo - Occurrence Information returned by server
 * @param {ViewModelTreeNode} parentNode - Parent uid of vm node
 * @param {String} vmNodeCreationStrategy - Strategy whether to reuse view model node from current view model collection.
 *
 * @return {ViewModelTreeNode} View Model Tree Node
 */
let _createVMTNodeUsingOccInfo = function( occInfo, parentNode, vmNodeCreationStrategy ) {
    var occUid = occInfo.occurrenceId;

    var occType = occInfo.underlyingObjectType;
    var modelObject = cdmSvc.getObject( occInfo.occurrenceId );
    if( modelObject ) {
        occType = modelObject.type;
    }

    var displayName = occInfo.displayName;
    if( !displayName ) {
        displayName = occUid;
    }

    var levelNdx = 0;
    if ( parentNode ) {
        levelNdx = parentNode.levelNdx + 1;
    }

    /*var message;
    for ( let i = 0; i < levelNdx; ++i ) {
        message += '  ';
    }
    message += 'Adding ' + displayName + ' ' + ' as child of ' + parentNode.displayName;
    console.log( message );*/
    var iconURL = occmgmtIconService.getTypeIconURL( occInfo, occType );

    var vmtNode = awTableSvc.createViewModelTreeNode( occUid, occType, displayName,
        levelNdx, occInfo.position, iconURL, vmNodeCreationStrategy );
    if ( vmtNode === undefined || vmtNode === null ) {
        console.log( 'undefined vmNode returned from createViewModelTreeNode' );
    }

    var nChild = occInfo.numberOfChildren;
    vmtNode.isLeaf = nChild <= 0;

    if ( parentNode ) {
        if( parentNode.isGreyedOutElement ) {
            vmtNode.isGreyedOutElement = parentNode.isGreyedOutElement;
        }

        vmtNode.parentUid = parentNode.occurrenceId;
    }

    vmtNode.stableId = occInfo.stableId;
    let contextKey;
    if( appCtxSvc.ctx.aceActiveContext ) {
        contextKey = appCtxSvc.ctx.aceActiveContext.key;
    }
    vmtNode.contextKey = contextKey;

    return vmtNode;
};

/*let _findUidInArray = function( uid, vmtNodes, expectedIndex ) {
    if ( expectedIndex < vmtNodes.length && vmtNodes[expectedIndex] === uid ) {
        return expectedIndex;
    }
    for ( let i = 0; i < vmtNodes.length; ++i ) {
        if ( vmtNodes[i].uid === uid ) {
            console.log( 'WARNING: child returned is not at expected index ' + expectedIndex + 'in existing parent. Correcting to ' + i );
            return i;
        }
    }
    console.log( 'WARNING: child returned cannot be found in existing parent.' );
    return -1;
};*/

let _validateExistingChildren = function( childOccInfos, cursor, vmtNodes ) {
    // Already validated that childOccInfos and cursor indexes align
    if ( vmtNodes.length < cursor.endIndex + 1 ) {
        console.log( 'WARNING: cursor end is out of range of existing parents children array' );
        return false;
    }
    let problems = 0;
    for( let i = 0; i < childOccInfos.length; ++i ) {
        if ( vmtNodes[i + cursor.startIndex].uid !== childOccInfos[i].occurrenceId ) {
            console.log( 'WARNING: child returned is not at expected index ' + i + cursor.startIndex + ' in existing parent' );
            ++problems;
        }
    }
    return problems === 0;
};

let _updateVMTNodeUsingOccInfo = function( existingVMTN, occInfo ) {
    existingVMTN.isLeaf = occInfo.numberOfChildren <= 0;
};

let _createVMTNodesForGivenOccurrences = function( childOccInfos, cursor, parentNode, vmNodeCreationStrategy, vmtNodes ) {
    let replaceNodes = cursor.startIndex === 0 && vmtNodes.length > 0;
    let newDataAligns = cursor.endIndex - cursor.startIndex + 1 === childOccInfos.length;
    if ( !replaceNodes && !newDataAligns ) {
        console.log( ' WARNING: Parent ' + parentNode.uid +
            ': Mismatch between cursor indexes ' + cursor.startIndex + ' ' + cursor.endIndex +
            ' and occInfo length: ' + childOccInfos.length );
    }
    if ( replaceNodes ) {
        // New children replace existing. Wipe out existing array and replace it
        // with children from response. Then continue with rest of function as 'simple create'
        vmtNodes = [];
    }
    if ( vmtNodes.length === cursor.startIndex ) {
        // Two cases:
        // 1. No existing children; simple create
        // 2. Cursor startIndex lines up with length of current array; simple append
        for( let i = 0; i < childOccInfos.length; ++i ) {
            // Removed elementToPciMap. Needed?
            let vmNode = _createVMTNodeUsingOccInfo( childOccInfos[i], parentNode, vmNodeCreationStrategy );
            vmtNodes.push( vmNode );
        }
    } else if ( vmtNodes.length > cursor.startIndex ) {
        // overlap between existing children and new childOccInfos
        // merge new childOccInfos with existing children array
        if ( _validateExistingChildren( childOccInfos, cursor, vmtNodes ) ) {
            // happy update path
            for( let i = 0; i < childOccInfos.length; ++i ) {
                _updateVMTNodeUsingOccInfo( vmtNodes[i + cursor.startIndex], childOccInfos[i] );
            }
        } else {
            // sad path: Perhaps sort orders of existing and new are different
            // should we write code to tolerate this? Or is it always a coding error (i.e. better to assert)?
            console.log( 'WARNING: Complex merge case of mismatched child arrays is not supported at this time' );
            console.log( childOccInfos );
            console.log( cursor );
            console.log( vmtNodes );
        }
    } else {
        // sad path 2
        // should we write code to tolerate this? Or is it always a coding error (i.e. better to assert)?
        console.log( 'WARNING: gap between existing children and new childOccInfos' );
    }
};

// In the delta case, childOccInfos are all 'adds'. We need to insert or append each
// new child to vmtNodes as appropriate. There is no cursor at present. The position 
// field in childOccInfos refers to the position in the array at the *end* of the
// merge operation.
let _mergeVMTNodesForGivenOccurrences = function( childOccInfos, parentNode, vmNodeCreationStrategy, vmtNodes ) {
    // Sort the occ infos, with -1 values at end
    childOccInfos.sort( ( a, b ) => a.position - b.position );
    let vmtNodesOut = [];
    let position = 0;
    let firstValidOccInfo = 0;
    while ( childOccInfos[oiIndex].position < 0 ) {
        ++firstValidOccInfo;
    }
    let oiIndex = firstValidOccInfo;
    for ( let node of vmtNodes ) {
        if ( position === childOccInfos[oiIndex].position ) {
            let vmNode = _createVMTNodeUsingOccInfo( childOccInfos[oiIndex], parentNode, vmNodeCreationStrategy );
            vmtNodesOut.push( vmNode );
            ++oiIndex;
        } else {
            vmtNodesOut.push( node );
            node.position = position;
        }
        ++position;
    }
    while ( oiIndex < childOccInfos.length - 1 ) {
        let vmNode = _createVMTNodeUsingOccInfo( childOccInfos[oiIndex], parentNode, vmNodeCreationStrategy );
        vmtNodesOut.push( vmNode );
        ++oiIndex;
    }
    if ( firstValidOccInfo > 0 ) {
        console.log( 'WARNING: Found occInfo(s) with invalid position -1 in delta children for ' + parentNode.uid );
        for ( let i = 0; i < firstValidOccInfo; ++i ) {
            childOccInfos[i].position = vmtNodesOut.length;
            let vmNode = _createVMTNodeUsingOccInfo( childOccInfos[oiIndex], parentNode, vmNodeCreationStrategy );
            vmtNodesOut.push( vmNode );
        }
    }
};

// eslint-disable-next-line no-unused-vars
let _logCollectedVMTN = function( parent, index ) {
    //console.log( 'visible VMOs: ' + parent.stableId );
    var message;
    for ( let i = 0; i < parent.levelNdx; ++i ) {
        message += '  ';
    }
    message += 'VMC[' + index + '] ' + parent.displayName;
    if ( parent.isExpanded ) {
        message += '[+]';
    }
    message += '( ' + parent.numberOfChildren + ' children)';
    console.log( message );
};

let _collectVisibleVMTNs = function( parent, vmNodes, index ) {
    vmNodes.push( parent );
    //_logCollectedVMTN( parent, index++ );
    if ( parent.children ) {
        for ( let child of parent.children ) {
            index = _collectVisibleVMTNs( child, vmNodes, index );
        }
    }
    return index;
};

/**
 * Mark any objects that match a UID in 'deletes' with the 'markForDeletion' property
 * @param {Array} objects array of VMO/VMTN
 * @param {Array} deletes array of UIDs that should be deleted
 * @returns {int} number of objects marked deleted
 */
function _markDeletes( objects, deletes ) {
    let deleted = 0;
    for ( let vmo of objects ) {
        if ( deletes.find( vmo.uid ) ) {
            ++deleted;
            vmo.markForDeletion = true;
        }
    }
    return deleted;
}

/**
 * Recursive function traverses a VMTN and all its sub-tree and removes any VMTNs
 * from the tree whose uids are in the 'deletes' array
 * @param {ViewModelTreeNode} parent top of assembly to process
 * @param {Array} deletes array of UIDs that should be deleted
 * @returns {int} number of deletes applied
 */
function _processAssemblyDeletes( parent, deletes ) {
    let numDeletes = 0;
    if ( parent.children && parent.children.length > 0 ) {
        let deleted = _markDeletes( parent.children, deletes );
        if ( deleted > 0 ) {
            parent.children = parent.children.filter( function( vmo ) {
                return !vmo.markForDeletion;
            } );
        }
        for ( let child of parent.children ) {
            numDeletes += _processAssemblyDeletes( child, deletes );
        }
    }
    return numDeletes;
}

export let applyDeltaDeletesToVmc = function( response, vmc ) {
    if ( response.requestPref &&
         response.requestPref.deletedObjectUids &&
         response.requestPref.deletedObjectUids.length > 0 ) {
        let deleteUids = response.requestPref.deletedObjectUids;
        let topVMO = vmc.loadedVMObjects[0];
        return _processAssemblyDeletes( topVMO, deleteUids );
    }
    return 0;
};

/**
 * Returns true if this response is a delta response
 * @param {Object} response response
 * @returns {boolean} true if this response is in delta format
 */
function _isDeltaResponse( response ) {
    return response.requestPref && response.requestPref.deltaTreeResponse &&
        response.requestPref.deltaTreeResponse[ 0 ].toLowerCase() === 'true';
}

export let createTreeNodesFromResponse = function( response, vmc ) {
    let createdNodes = new Map();

    let vmNodeCreationStrategy = {
        reuseVMNode: true,
        clearExpandState: true,
        staleVMNodeUids: []
    };

    let delta = _isDeltaResponse( response );
    //Parent level from which occurrences have been returned
    for ( let parentChildInfo of response.parentChildrenInfos ) {
        let parentId = parentChildInfo.parentInfo.occurrenceId;
        let parentNode = createdNodes.get( parentId );
        if ( parentNode === undefined ) {
            let parentObjNdx = vmc.findViewModelObjectById( parentId );
            parentNode = vmc.getViewModelObject( parentObjNdx );
        }
        //console.log( 'creating tree nodes for parent: ' + parentId + ' parentNode: ' + parentNode );
        //console.log( ' -- children in response: ' + parentChildInfo.childrenInfo );

        if ( parentNode !== undefined ) {
            // In expand below, display all parents with children as expanded
            parentNode.isExpanded = true;
            if ( parentNode.children === undefined ) {
                parentNode.children = [];
            }
            if ( !delta ) {
                _createVMTNodesForGivenOccurrences( parentChildInfo.childrenInfo, parentChildInfo.cursor, parentNode,
                    vmNodeCreationStrategy, parentNode.children );
            } else {
                _mergeVMTNodesForGivenOccurrences( parentChildInfo.childrenInfo, parentNode,
                    vmNodeCreationStrategy, parentNode.children );
            }
            for ( let node of parentNode.children ) {
                //console.log( 'created ' + node.id + ' as ' + node );
                createdNodes.set( node.id, node );
            }
        } else {
            console.log( 'WARNING: node ' + parentChildInfo.childrenInfo[0].occurrenceId + ' has no parent with ID ' + parentId );
            let vmtNodes = [];
            if ( !delta ) {
                _createVMTNodesForGivenOccurrences( parentChildInfo.childrenInfo, parentChildInfo.cursor, parentNode,
                    vmNodeCreationStrategy, vmtNodes );
            } else {
                _mergeVMTNodesForGivenOccurrences( parentChildInfo.childrenInfo, parentNode,
                    vmNodeCreationStrategy, vmtNodes );
            }
            for ( let node of vmtNodes ) {
                //console.log( 'created ' + node.id + ' as ' + node );
                createdNodes.set( node.id, node );
            }
        }

        //If level is incomplete (head/tail), update VM Nodes with that info
        //_updateVMNodesWithIncompleteHeadTailInfo( parentChildInfo.cursor, vmNodes );
    }
    return response.parentChildrenInfos.length;
};

export let updateTreeVMC = function( vmc, repaint ) {
    // Update the ViewModelCollection and other attributes
    // this keeps Tree happy and avoids it calling back to us
    let topVMO = vmc.loadedVMObjects[0];
    if ( repaint ) {
        let vmtNodes = [];
        _collectVisibleVMTNs( topVMO, vmtNodes, 0 );
        vmc.update( vmtNodes );
    } else {
        vmc.loadedVMObjects = [];
        _collectVisibleVMTNs( topVMO,  vmc.loadedVMObjects, 0 );
    }
};

export let applyResponseToTree = function( response, vmc, repaint ) {
    let numDeletes = applyDeltaDeletesToVmc( response, vmc );
    let numUpdates = createTreeNodesFromResponse( response, vmc );
    if ( numUpdates > 0 ) {
        let topVMO = vmc.loadedVMObjects[0];
        if ( repaint ) {
            let vmtNodes = [];
            _collectVisibleVMTNs( topVMO, vmtNodes, 0 );
            vmc.update( vmtNodes );
        } else {
            vmc.loadedVMObjects = [];
            _collectVisibleVMTNs( topVMO,  vmc.loadedVMObjects, 0 );
        }
    } else if ( numDeletes > 0 && repaint ) {
        // Trigger an update for the deletes alone
        vmc.update( vmc.loadedVMObjects );
    }
};

let exports = {
    applyResponseToTree
};
export default exports;
