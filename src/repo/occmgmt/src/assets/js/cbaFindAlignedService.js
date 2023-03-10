// Copyright (c) 2022 Siemens

/**
 * Service defines functionality related to find aligned objects.
 * @module js/cbaFindAlignedService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import cbaConstants from 'js/cbaConstants';
import eventBus from 'js/eventBus';
import CadBomOccurrenceAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';
import CBAImpactAnalysisService from 'js/CBAImpactAnalysisService';
import _ from 'lodash';
import soaService from 'soa/kernel/soaService';
import messagingService from 'js/messagingService';
import dataManagementSvc from 'soa/dataManagementService';
import occmgmtUtils from 'js/occmgmtUtils';

/**
  *API to invoke SOA to fetch find aligned data
  *
  * @param {Object} findAlignedInput - Find aligned input object
  * @returns {Object} The response object
  */
let _invokeFindAlignedOccurrencesSoa = function( findAlignedInput ) {
    return soaService
        .postUnchecked( 'Internal-EntCba-2021-12-Alignments', 'findAlignedOccurrences', findAlignedInput ).then(
            function( response ) {
                if( response.ServiceData && response.ServiceData.partialErrors ) {
                    return CadBomOccurrenceAlignmentUtil.processErrorsAndWarnings( response );
                }

                if ( response && response.output && response.output.length > 0 ) {
                    let alignedInfo = response.output[ 0 ];
                    let alignedOccurrences = alignedInfo.alignedOccurrences;
                    if (  !alignedOccurrences || alignedOccurrences.length === 0 ) {
                        let inputObj = cdm.getObject( findAlignedInput.occurrences[0].uid );
                        let msg = CadBomOccurrenceAlignmentUtil.getLocalizedMessage( 'CadBomAlignmentMessages', 'FindAlignedNoAlignment', [ inputObj ] );
                        messagingService.showError( msg );
                    }
                }
                return response;
            } );
};

/**
 * Get aligned object for selected object
 *
 * @param {object} syncObject - Sync object which contains selected VMO, Source Context
 * @param {object} syncContext - Sync Context
 * @returns{object} - Alignment Info object which contains sourceObject and list of aligned objects
 */
export let getAlignedObjectsInfo = async function( syncObject, syncContext ) {
    let alignedObjectInfo = {
        alignedObjects: []
    };

    if( syncObject ) {
        let selectedObjectUid;
        if( syncObject.vmo ) {
            selectedObjectUid = syncObject.vmo.uid;
            let selectedModelObject = cdm.getObject( selectedObjectUid );
            alignedObjectInfo.sourceObject = selectedModelObject;
        }

        let sourceContext = syncObject.contextName;
        let contextMenuAction = syncObject.contextMenuAction;

        if( selectedObjectUid && sourceContext ) {
            let alignmentCheckInfo = appCtxSvc.getCtx( cbaConstants.CTX_PATH_ALIGNMENT_CHECK_INFO );
            let findAlignedInfo = appCtxSvc.getCtx( cbaConstants.CTX_PATH_FIND_ALIGNED_INFO );

            if( alignmentCheckInfo && alignmentCheckInfo[ sourceContext ] ) {
                let differences = alignmentCheckInfo[ sourceContext ].differences;
                let differenceObj = differences && differences[ selectedObjectUid ] ? differences[ selectedObjectUid ] : null;
                alignedObjectInfo.alignedObjects = differenceObj && differenceObj.mappingUids ? differenceObj.mappingUids : [];
            } else if( findAlignedInfo && findAlignedInfo[ sourceContext ] ) {
                // LCS-633501: Always make findAlignedOccurrences SOA call for an element in EBOM structure
                if( sourceContext !== cbaConstants.CBA_TRG_CONTEXT ) {
                    let contextInfo = findAlignedInfo[ sourceContext ];
                    let differenceObj = contextInfo && contextInfo[ selectedObjectUid ] ? contextInfo[ selectedObjectUid ] : null;
                    alignedObjectInfo.alignedObjects = differenceObj && differenceObj.mappingUids ? differenceObj.mappingUids : [];
                }
            }

            if( alignedObjectInfo.alignedObjects.length === 0 && contextMenuAction ) {
                clearFindAlignedIndicatorStatus();
            }

            if( alignedObjectInfo.alignedObjects.length === 0 ) {
                let findAlignedInput = {
                    targetContext: syncContext.targetViewModel.subPanelContext.provider.occContext.openedElement,
                    occurrences:  [ alignedObjectInfo.sourceObject ]
                };

                // Make server call
                let findAlignedResponse = await _invokeFindAlignedOccurrencesSoa( findAlignedInput );
                findAlignedResponse = processFindAlignedResponse( findAlignedResponse, sourceContext );

                clearFindAlignedIndicatorStatus();
                appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_FIND_ALIGNED_INFO, findAlignedResponse.findAlignedInfo );
                notifyVMOPropertiesUpdated( { findAlignedInfo:findAlignedResponse.findAlignedInfo } );

                alignedObjectInfo.alignedObjects = findAlignedResponse.objectsToFind;
            }
        }
        let alignedObjectsList = [];
        alignedObjectInfo.firstObjectToFind = [];
        if ( alignedObjectInfo.alignedObjects.length > 0 ) {
            await dataManagementSvc.loadObjects( alignedObjectInfo.alignedObjects );
            for ( let index = 0; index < alignedObjectInfo.alignedObjects.length; index++ ) {
                const updatedUid = alignedObjectInfo.alignedObjects[ index ];
                alignedObjectsList.push( cdm.getObject( updatedUid ) );
            }
            alignedObjectInfo.alignedObjects = alignedObjectsList;
            alignedObjectInfo.firstObjectToFind.push( alignedObjectInfo.alignedObjects[ 0 ] );
            alignedObjectInfo.restObjectToFind = alignedObjectInfo.alignedObjects.length > 1 ? alignedObjectInfo.alignedObjects.slice( 1 ) : [];
        }
    }
    return alignedObjectInfo;
};

/**
 * Clear Alignment Indicators
 */
export let clearFindAlignedIndicatorStatus = function() {
    eventBus.publish( 'cba.clearAlignmentCheckIndicators' );
};

/**
 *  Process Find aligned SOA response
 * @param {object} response  - response onjfect of findAlignedOccurrences SOA
 * @param {string} sourceContext  - context key where selection is perfomed
 * @returns {object} - Find Aligned created response
 */
export let processFindAlignedResponse = function( response, sourceContext ) {
    let findAlignedResponse = {};
    if( response && response.output && response.output.length > 0 ) {
        let alignedInfo = response.output[ 0 ];

        findAlignedResponse.sourceObject = alignedInfo.occurrence;
        let targetMappingObject = {};
        let sourceMappingObject = {};

        let targetContext = cbaConstants.CBA_TRG_CONTEXT;
        if( sourceContext === cbaConstants.CBA_TRG_CONTEXT ) {
            targetContext = cbaConstants.CBA_SRC_CONTEXT;
        }

        findAlignedResponse.objectsToFind = [];
        let alignOccurrences = alignedInfo.alignedOccurrences;
        if( alignOccurrences ) {
            for( let index = 0; index < alignOccurrences.length; index++ ) {
                findAlignedResponse.objectsToFind.push( alignOccurrences[ index ].uid );

                targetMappingObject[ alignOccurrences[ index ].uid ] = {
                    status: -1,
                    mappingUids: [ findAlignedResponse.sourceObject.uid ]
                };
            }

            sourceMappingObject[ findAlignedResponse.sourceObject.uid ] = {
                status: -1,
                mappingUids: findAlignedResponse.objectsToFind
            };

            if( findAlignedResponse.objectsToFind.length > 0 ) {
                findAlignedResponse.firstObjectToFind = [ findAlignedResponse.objectsToFind[0] ];
                findAlignedResponse.restObjectToFind = findAlignedResponse.objectsToFind.length > 1 ? findAlignedResponse.objectsToFind.slice( 1 ) : [];
            }
        }

        let findAlignedInfo = {};
        findAlignedInfo[ sourceContext ] = sourceMappingObject;
        findAlignedInfo[ targetContext ] = targetMappingObject;
        findAlignedResponse.findAlignedInfo = findAlignedInfo;
        findAlignedResponse.sourceObjects = [ findAlignedResponse.sourceObject.uid ];
    }
    return findAlignedResponse;
};

/**
 * Get mapping objects
 * @param {object} contextMappingObj Context Mapping Object
 * @param {string} srcColumn alignment column name where selection is performed
 * @param {string} trgColumn alignment column name where aligned objects to hilight
 * @returns{object} - Mapping object
 */
let _getMappingObject = function( contextMappingObj, srcColumn, trgColumn ) {
    let mappedObj = {};

    for( const property in contextMappingObj ) {
        mappedObj[ property ] = [ srcColumn ];

        let mappingUids = contextMappingObj[ property ].mappingUids;

        for( let index = 0; index < mappingUids.length; index++ ) {
            const element = mappingUids[ index ];
            mappedObj[ element ] = [ trgColumn ];
        }
    }
    return mappedObj;
};

/**
 * Notify property update to renderers
 * @param {object} data - Object which contents context wise aligned object mapping
 */
export let notifyVMOPropertiesUpdated = function( data ) {
    let updateAlignmentCheckStatus = {};
    let findAlignedInfo = data.findAlignedInfo;
    if( findAlignedInfo ) {
        let srcContextMappingObj = findAlignedInfo[ cbaConstants.CBA_SRC_CONTEXT ];
        let srcMappedObj = _getMappingObject( srcContextMappingObj, 'srcAlignmentIndication', 'trgAlignmentIndication' );
        let trgContextMappingObj = findAlignedInfo[ cbaConstants.CBA_TRG_CONTEXT ];
        let trgMappedObj = _getMappingObject( trgContextMappingObj, 'trgAlignmentIndication', 'srcAlignmentIndication' );
        updateAlignmentCheckStatus = { ...srcMappedObj, ...trgMappedObj };
    }
    eventBus.publish( 'viewModelObject.propsUpdated', updateAlignmentCheckStatus );
};

/**
 * Get status of given uid of context
 * @param {String} contextKey view key that represent the view
 * @param {object} vmo View Model Object
 * @return {number} Indicator status for vmo
 */
export let getIndicatorStatus = function( contextKey, vmo ) {
    let status = isFindAlignedSupported( vmo ) ? 0 : null;
    if( status === 0 ) {
        let findAlignedInfo = appCtxSvc.getCtx( cbaConstants.CTX_PATH_FIND_ALIGNED_INFO );
        if( findAlignedInfo ) {
            let contextFindAlignedInfo = findAlignedInfo[ contextKey ];
            if( contextFindAlignedInfo && contextFindAlignedInfo[ vmo.uid ] ) {
                let diff1 = contextFindAlignedInfo[ vmo.uid ];
                status = diff1 ? diff1.status : 0;
            }
        }
    }
    return status;
};

/**
 * Check if find aligned is supported or not
 *
 * @param {object} vmo  View Model Object
 * @returns {boolean} - true if find aligned supported else false
 */
export let isFindAlignedSupported = function( vmo ) {
    let isImpactAnalysisMode = CBAImpactAnalysisService.isImpactAnalysisMode();
    if( !isImpactAnalysisMode ) {
        let areMultipleStructureInCBA = CadBomOccurrenceAlignmentUtil.areMultipleStructuresInCBA();
        if( areMultipleStructureInCBA && vmo.levelNdx > 0 && CadBomOccurrenceAlignmentUtil.isValidObjectForAlignment( vmo ) ) {
            return true;
        }
    }
    return false;
};

/**
 * Check if VMO is available in given context, also check if the VMO is selected in in given context
 * @param {string} vmoUid VMO uid to check
 * @param {string} contextKey source or target context key
 * @param {boolean} selectedOnly true if VMP selection needs to check else false
 * @returns {boolean} true if VMO is available in context else false. If selectedOnly==true 
 * then returns true only if VMO is available and selected else returns false
 */
let _isVMOAvailableInContext = function( vmoUid, contextKey, selectedOnly ) {
    let vmc = appCtxSvc.getCtx( contextKey + '.vmc' );

    let index = vmc.findViewModelObjectById( vmoUid );
    if( index !== -1 ) {
        if( selectedOnly ) {
            let vmo = vmc.getViewModelObject( index );
            if( vmo && vmo.selected ) {
                return true;
            }
            return false;
        }
        return true;
    }
    return false;
};

/**
 * Sort updated uids in source and target wise
 * @param {Array} updatedIds Update uids
 * @returns {object} Object containing sourceSelection and targetSelection
 */
let _sortOutSelectedUid = function( updatedIds ) {
    let output = {
        sourceSelection: [],
        targetSelection: []
    };

    for( let index = 0; index < updatedIds.length; index++ ) {
        const updatedUid = updatedIds[ index ];

        if( _isVMOAvailableInContext( updatedUid, cbaConstants.CBA_SRC_CONTEXT, true ) ) {
            output.sourceSelection.push( updatedUid );
        } else if( _isVMOAvailableInContext( updatedUid, cbaConstants.CBA_TRG_CONTEXT, true ) ) {
            output.targetSelection.push( updatedUid );
        }
    }
    return output;
};

/**
 * Delete mapping uids from find aligned context
 * 
 * @param {List} uids Updated uids
 * @param {object} contextFindAlignedInfo Context find aligned info cache
 * @param {string} currentSelectedUid Current selected uid on which action is performed
 * @returns {object} updated finfd aligned context object
 */
let _deleteFromContext = function( uids, contextFindAlignedInfo, currentSelectedUid ) {
    for( let index = 0; index < uids.length; index++ ) {
        const uid = uids[ index ];
        let mappedObj = contextFindAlignedInfo[ uid ];

        if( mappedObj ) {
            let mappingUids = mappedObj.mappingUids;
            if( mappingUids.length === 1 && mappingUids[ 0 ] === currentSelectedUid ) {
                delete contextFindAlignedInfo[ uid ];
            } else {
                let matchedIdx = mappingUids.indexOf( currentSelectedUid );
                if( matchedIdx !== -1 ) {
                    mappingUids.splice( matchedIdx, 1 );
                    if( mappingUids.length === 0 ) {
                        delete contextFindAlignedInfo[ uid ];
                    } else {
                        contextFindAlignedInfo[ uid ].mappingUids = mappingUids;
                    }
                }
            }
        }
    }
    return contextFindAlignedInfo;
};

/**
 * Handle alignment perfomed on find aligned objects
 * 
 * @param {*} srcSelection source selection
 * @param {*} trgSelection target selection
 * @param {*} srcCtxFindAlignedInfo source context find aligned 
 * @param {*} trgCtxFindAlignedInfo target context find aligned
 * @returns {object} object containing flag to indicate alignment is handled and laso update find aligned contexts
 */
let _handleAlignment = function( srcSelection, trgSelection, srcCtxFindAlignedInfo, trgCtxFindAlignedInfo ) {
    let result = {
        isAlignmentHandled: false,
        srcContextFindAlignedInfo: srcCtxFindAlignedInfo,
        trgContextFindAlignedInfo: trgCtxFindAlignedInfo
    };
    let srcIndicatorAvailable = srcCtxFindAlignedInfo[ srcSelection ];
    let trgIndicatorAvailable = trgCtxFindAlignedInfo[ trgSelection ];

    if( srcIndicatorAvailable && !trgIndicatorAvailable ) {
        result.srcContextFindAlignedInfo[ srcSelection ].mappingUids.push( trgSelection );
        result.trgContextFindAlignedInfo[ trgSelection ] = { mappingUids: [ srcSelection ], status: -1 };
        result.isAlignmentHandled = true;
    }
    if( !srcIndicatorAvailable && trgIndicatorAvailable ) {
        result.trgContextFindAlignedInfo[ trgSelection ].mappingUids.push( srcSelection );
        result.srcContextFindAlignedInfo[ srcSelection ] = { mappingUids: [ trgSelection ], status: -1 };
        result.isAlignmentHandled = true;
    }
    return result;
};
/**
 * Reset find aligned indicator to intermediate state.
 *
 * @param {Object} updatedIds - List of updated uids
 */
export let resetFindAlignedState = function( updatedIds ) {
    let sortedSelectedUids = _sortOutSelectedUid( updatedIds );
    let sourceSelections = sortedSelectedUids.sourceSelection;
    let targetSelections = sortedSelectedUids.targetSelection;

    let isSrcSelected = sourceSelections.length > 0;
    let isTrgSelected = targetSelections.length > 0;

    let findAlignedInfo = appCtxSvc.getCtx( cbaConstants.CTX_PATH_FIND_ALIGNED_INFO );

    if( findAlignedInfo && !_.isEmpty( findAlignedInfo ) ) {
        let trgContextFindAlignedInfo = findAlignedInfo[ cbaConstants.CBA_TRG_CONTEXT ];
        let srcContextFindAlignedInfo = findAlignedInfo[ cbaConstants.CBA_SRC_CONTEXT ];

        // Source and Target selected
        if( isSrcSelected ) {
            let isAlignmentHandled = false;
            if( sourceSelections.length === 1 && isTrgSelected && targetSelections.length === 1 ) {
                let handledResult = _handleAlignment( sourceSelections[ 0 ], targetSelections[ 0 ], srcContextFindAlignedInfo, trgContextFindAlignedInfo );
                isAlignmentHandled = handledResult.isAlignmentHandled;
                srcContextFindAlignedInfo = handledResult.srcContextFindAlignedInfo;
                trgContextFindAlignedInfo = handledResult.trgContextFindAlignedInfo;
            }

            if( !isAlignmentHandled ) {
                for( let index = 0; index < sourceSelections.length; index++ ) {
                    const srcSelectedUid = sourceSelections[ index ];

                    if( srcContextFindAlignedInfo[ srcSelectedUid ] ) {
                        let mappedTrgUids = srcContextFindAlignedInfo[ srcSelectedUid ].mappingUids;
                        trgContextFindAlignedInfo = _deleteFromContext( mappedTrgUids, trgContextFindAlignedInfo, srcSelectedUid );
                        delete srcContextFindAlignedInfo[ srcSelectedUid ];
                    }
                }
            }
        } else if( isTrgSelected ) {
            for( let index = 0; index < targetSelections.length; index++ ) {
                const trgSelectedUid = targetSelections[ index ];

                if( trgContextFindAlignedInfo[ trgSelectedUid ] ) {
                    let mappedSrcUids = trgContextFindAlignedInfo[ trgSelectedUid ].mappingUids;
                    srcContextFindAlignedInfo = _deleteFromContext( mappedSrcUids, srcContextFindAlignedInfo, trgSelectedUid );
                    delete trgContextFindAlignedInfo[ trgSelectedUid ];
                }
            }
        }

        findAlignedInfo[ cbaConstants.CBA_TRG_CONTEXT ] = trgContextFindAlignedInfo;
        findAlignedInfo[ cbaConstants.CBA_SRC_CONTEXT ] = srcContextFindAlignedInfo;

        appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_FIND_ALIGNED_INFO, findAlignedInfo );
        eventBus.publish( 'cba.refreshTree' );
    }
};

/**
 * Select object in tree.
 * @param {object} eventData - event data
 */
export let selectObjectsInTree = function( eventData ) {
    let elementsToSelect = [];

    let objectsToSelect = eventData.objectsToSelect;
    let occContext = eventData.occContext;
    if( objectsToSelect && occContext ) {
        let vmc = occContext.vmc;
        let parentVMO;

        if( vmc ) {
            for( let idx = 0; idx < objectsToSelect.length; idx++ ) {
                const parentUid = objectsToSelect[ idx ].props.awb0Parent.dbValues[ 0 ];
                let index = vmc.findViewModelObjectById( parentUid );
                if( index !== -1 ) {
                    parentVMO = vmc.getViewModelObject( index );
                    if( parentVMO ) {
                        break;
                    }
                }
            }
        }

        if( parentVMO ) {
            elementsToSelect = objectsToSelect;
        } else if( objectsToSelect.length > 0 ) {
            elementsToSelect.push( objectsToSelect[ 0 ] );
        }

        if( parentVMO && !parentVMO.isExpanded && elementsToSelect.length === 1 ) {
            elementsToSelect.push( elementsToSelect[ 0 ] );
        }
    }
    let value = {
        elementsToSelect: elementsToSelect,
        overwriteSelections: eventData.overwriteSelection
    };
    occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', value, occContext );
};

/**
 * cbaFindAlignedService
 */

const exports = {
    getAlignedObjectsInfo,
    processFindAlignedResponse,
    notifyVMOPropertiesUpdated,
    clearFindAlignedIndicatorStatus,
    getIndicatorStatus,
    isFindAlignedSupported,
    resetFindAlignedState,
    selectObjectsInTree
};
export default exports;
