// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@


import wiPMIConstants from 'js/wiPMIConstants';
import cdm from 'soa/kernel/clientDataModel';
import epLoadInputHelper from 'js/epLoadInputHelper';
import epLoadService from 'js/epLoadService';
import epPropCacheSvc from 'js/epObjectPropertyCacheService';
import epSaveService from 'js/epSaveService';
import epTableService from 'js/epTableService';
import mfeFilterAndSortSvc from 'js/mfeFilterAndSortService';
import mfeTableService from 'js/mfeTableService';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import saveInputWriterService from 'js/saveInputWriterService';
import vmoSvc from 'js/viewModelObjectService';
import localeSvc from 'js/localeService';


/**
 * WI PMI service
 *
 * @module js/wiPmiService
 */


// PMI_ASSOCIATION_TYPE_COMPOSITE           1
// PMI_ASSOCIATION_TYPE_STACKED             2
// PMI_ASSOCIATION_TYPE_PATTERN             4
const groupableAssociationTypes = [ '1', '2' ];
const isGroupableAssociationType = ( associationType ) => groupableAssociationTypes.indexOf( associationType ) > -1;

/**
 *
 * @param {string} contextUid - the context uid we want to get its' assigned Pmis
 * @param {object} columnPolicyObj - property policy
 * @param {object} additionalPolicyObj - additional policy object
 * @return {promise<modelObject[]>} a promise object which is resolved to an array of modelObjects
 */
function loadAssignedPmis( currentScopeUid, contextUid, columnPolicyObj, additionalPolicyObj ) {
    if( !contextUid ) {
        return new Promise( ( resolve ) => {
            resolve( null );
        } );
    }
    const additionalParam = [ {
        tagName: 'sourceObject',
        attributeName: 'objectUid',
        attributeValue: [ currentScopeUid ]
    } ];
    columnPolicyObj && propPolicySvc.register( columnPolicyObj );
    additionalPolicyObj && propPolicySvc.register( additionalPolicyObj );
    const loadInputTypes = epLoadInputHelper.getLoadTypeInputs( [ wiPMIConstants.INSPECTIONS ], contextUid, [], '', additionalParam );
    return epLoadService.loadObject( loadInputTypes, false ).then( () => {
        const inspectionsUids = epPropCacheSvc.getProperty( contextUid, wiPMIConstants.INSPECTIONS );
        return {
            assignedPmis: inspectionsUids.map( inspection => cdm.getObject( inspection ) ),
            contexObjUid: contextUid
        };
    } );
}
/**
 * Handle the events which were returned from the save soa server call
 *
 * @param {string} eventObjectUid - the uid of the object which we added or removed inspection objects
 * @param {string[]} inspectionsAdded - the new inspections uids that were assigned to the eventObjectUid
 * @param {string[]} inspectionsRemoved - the removed inspections uids that were unassigned from the eventObjectUid
 * @param {Object} dataProvider - the table data provide
 * @param {Array} pmiColumnConfiguration array
 * @return {string[]} array of inspection uids
 */
function handleAddRemoveInspections( eventObjectUid, inspectionsAdded, inspectionsRemoved, dataProvider, pmiColumnConfiguration ) {
    if ( inspectionsAdded ) {
        epPropCacheSvc.updateProperty( eventObjectUid, wiPMIConstants.INSPECTIONS, inspectionsAdded );
        epTableService.addNewObjectsToDataProvider( inspectionsAdded, dataProvider, true );
        const loadedVmos = dataProvider.getViewModelCollection().loadedVMObjects;
        const newVmos = loadedVmos.filter( vmo => inspectionsAdded.indexOf( vmo.uid ) > -1 );
        addDefindInPropToVmos( newVmos, pmiColumnConfiguration );
    } else if ( inspectionsRemoved ) {
        epPropCacheSvc.removeProperty( eventObjectUid, wiPMIConstants.INSPECTIONS, inspectionsRemoved );
        mfeTableService.removeFromDataProvider( inspectionsRemoved, dataProvider );
    }
    return epPropCacheSvc.getProperty( eventObjectUid, wiPMIConstants.INSPECTIONS );
}

/**
 *
 * @param {modelObject} context - the context we assign to
 * @param {string[]} characteristicPmiUids - the characteristic pmi uids
 */
function assignPmisToCurrentContext( context, characteristicPmiUids ) {
    if ( !context || !characteristicPmiUids ) {
        return;
    }
    const saveInputWriter = saveInputWriterService.get();
    const relatedObjects = characteristicPmiUids.map( pmiUid => cdm.getObject( pmiUid ) );
    relatedObjects.push( cdm.getObject( context.uid ) );
    saveInputWriter.addRelatedObjects( relatedObjects );
    saveInputWriter.addRemoveAssignedPMIs( context, characteristicPmiUids );
    epSaveService.saveChanges( saveInputWriter, true );
}

/**
 *
 * @param {String} contextUid - the context object uid we need to load the pmi for
 * @param {Object} columnPolicyObj - property policy
 * @param {object} sortCriteria - the sort criteria object
 * @param {object} columnFilters - the column filters object
 * @param {Boolean} fetchFromCache - true if want to use previously loaded data
 * @return {promise} a promise object
 */
function loadAssemblyPmis( contextUid, selectedMethod, columnPolicyObj, sortCriteria, columnFilters, fetchFromCache ) {
    if( contextUid ) {
        columnPolicyObj && propPolicySvc.register( columnPolicyObj );
        return getPmiUids( contextUid, selectedMethod, fetchFromCache ).then(
            ( pmiUids ) => {
                const characteristicList = [];
                if( Array.isArray( pmiUids ) && pmiUids.length > 0 ) {
                    pmiUids.forEach( ( pmiUid ) => {
                        const chxList = epPropCacheSvc.getProperty( pmiUid, wiPMIConstants.PMI_CHARACTERISTICS_PSEUDO_PROP );
                        const chxModelObjs = chxList.map( ( characteristic ) => cdm.getObject( characteristic ) );
                        characteristicList.push( ...chxModelObjs );
                    } );
                }
                return characteristicList;
            }
        )
            .then( ( characteristicList ) => filterAndSortAssemblyPmi( characteristicList, sortCriteria, columnFilters ) );
    }
    return new Promise( ( resolve ) => {
        resolve( null );
    } );
}

/**
 * Gets all of the pmi uids which are associated to a given uid
 * @param {string} contextUid - the context uid
 * @param {boolean} fetchFromCache - false to load data from server
 * @return {promise<string[]>}  a promise which is resolved to a string array of pmi uids
 */
function getPmiUids( contextUid, selectedMethod, fetchFromCache = true ) {
    if( fetchFromCache ) {
        const pmiUids = epPropCacheSvc.getProperty( contextUid, wiPMIConstants.PMI_ASSEMBLY_PMIS_PSEUDO_PROP );
        if( Array.isArray( pmiUids ) ) {
            return new Promise( ( resolve ) => {
                resolve( pmiUids );
            } );
        }
    }
    const additionalParam = [ {
        tagName: 'methodToLoad',
        attributeName: 'methodName',
        attributeValue: [ selectedMethod ]
    } ];
    const loadInputTypes = epLoadInputHelper.getLoadTypeInputs( [ wiPMIConstants.LOAD_ASSEMBLY_PMIS_TYPE ], contextUid, [], '', additionalParam );
    return epLoadService.loadObject( loadInputTypes, false ).then( () => {
        return epPropCacheSvc.getProperty( contextUid, wiPMIConstants.PMI_ASSEMBLY_PMIS_PSEUDO_PROP );
    } );
}

/**
 * @param {ModelObject[]} characteristicList - a given set of modelObjects
 * @param {object[]} sortCriteria - the sort criteria object array
 * @param {object[]} columnFilters - the filters object array
 * @return {modelObject[]} a filtered array of modelObjects
 */
function filterAndSortAssemblyPmi( characteristicList, sortCriteria, columnFilters ) {
    let isDefinedInSortedOrFiltered = false;

    // check if DefinedIn property needs filtering or sorting
    if( columnFilters ) {
        for ( let index = 0; index < columnFilters.length; index++ ) {
            if( columnFilters[index].columnName === wiPMIConstants.PMI_DEFINED_IN_COLUMN_PROPERTY_NAME ) {
                isDefinedInSortedOrFiltered = true;
                break;
            }
        }
    }
    if( sortCriteria && !isDefinedInSortedOrFiltered ) {
        for( let index = 0; index < sortCriteria.length; index++ ) {
            if( sortCriteria[ index ].fieldName === wiPMIConstants.PMI_DEFINED_IN_COLUMN_PROPERTY_NAME ) {
                isDefinedInSortedOrFiltered = true;
                break;
            }
        }
    }

    // temporarly add DefinedIn property to ModelObject
    if( isDefinedInSortedOrFiltered ) {
        characteristicList.forEach( ( chxModelObj ) => {
            const contextUids = epPropCacheSvc.getProperty( chxModelObj.uid, wiPMIConstants.PMI_CONTEXT_PSEUDO_PROP );
            const contextModelObj = cdm.getObject( contextUids[ 0 ] );
            chxModelObj.props[wiPMIConstants.PMI_DEFINED_IN_COLUMN_PROPERTY_NAME] = contextModelObj.props.object_string;
        } );
    }

    // filter and sort all column
    const filteredList = mfeFilterAndSortSvc.filterModelObjects( characteristicList, columnFilters );
    const sortedFilterdList = mfeFilterAndSortSvc.sortModelObjects( filteredList, sortCriteria );

    // remove temporary DefinedIn property from ModelOject
    if( isDefinedInSortedOrFiltered ) {
        sortedFilterdList.forEach( ( chxModelObj ) => {
            delete chxModelObj.props[wiPMIConstants.PMI_DEFINED_IN_COLUMN_PROPERTY_NAME];
        } );
    }

    return sortedFilterdList;
}

/**
 *
 * @param {ViewModelObject[]} pmiVmos - Loaded assembly pmi VMOs
 * @param {Array} pmiColumnConfiguration array
 */
function addDefindInPropToVmos( pmiVmos, pmiColumnConfiguration ) {
    if( pmiVmos && isDefinedInColumnConfigured( pmiColumnConfiguration ) ) {
        pmiVmos.forEach( ( pmiVmo ) => {
            const contextUids = epPropCacheSvc.getProperty( pmiVmo.uid, wiPMIConstants.PMI_CONTEXT_PSEUDO_PROP );
            const contextModelObj = cdm.getObject( contextUids[ 0 ] );
            const displayValue = contextModelObj.props.object_string.dbValues;
            const value = displayValue;

            const whereDefinedProp = {
                value,
                displayValue,
                propType: 'STRING',
                isArray: false
            };
            pmiVmo.props[ wiPMIConstants.PMI_DEFINED_IN_COLUMN_PROPERTY_NAME ] =
                vmoSvc.constructViewModelProperty( whereDefinedProp, wiPMIConstants.PMI_DEFINED_IN_COLUMN_PROPERTY_NAME, pmiVmo, false );
        } );
    }
}

/**
 *
 * @param {eventObject[]} saveEvents returnd event list from save call
 */
function postSaveAddDefindInPropToVmos( saveEvents ) {
    const whereDefinedEvents = saveEvents.filter( ( event ) => event.eventType === wiPMIConstants.PMI_WHERE_DEFINED_EVENT_NAME );
    whereDefinedEvents.forEach( ( event ) => {
        if( event.eventData[0] === wiPMIConstants.PMI_CONTEXT_PSEUDO_PROP ) {
            epPropCacheSvc.updateProperty( event.eventObjectUid, wiPMIConstants.PMI_CONTEXT_PSEUDO_PROP, [ event.eventData[1] ] );
        }
    } );
}

/**
 *
 * @param {Array} preferenceValue preference value of column configuration
 * @return {Boolean} true/false
 */
function isDefinedInColumnConfigured( preferenceValue ) {
    let result = false;
    const definedInConfigurationString = wiPMIConstants.PMI_DEFINED_IN_COLUMN_TYPE_NAME + '.' + wiPMIConstants.PMI_DEFINED_IN_COLUMN_PROPERTY_NAME;
    if( Array.isArray( preferenceValue ) ) {
        for ( const entry of preferenceValue ) {
            if( entry.indexOf( definedInConfigurationString ) > -1 ) {
                result = true;
                break;
            }
        }
    }
    return result;
}

/**
 * Custom renderer for Defined In Column Header
 * @param {Object} containerElement - DOM Object
 * @param {String} columnField - column name
 * @param {String} tooltip - tooltip
 * @param {Object} column - column Object
 */
function renderDefinedIn( containerElement, columnField, tooltip, column ) {
    if( column.typeName === wiPMIConstants.PMI_DEFINED_IN_COLUMN_TYPE_NAME && columnField === wiPMIConstants.PMI_DEFINED_IN_COLUMN_PROPERTY_NAME ) {
        const localizedStrings = localeSvc.getLoadedText( 'wiPmiMessages' );
        containerElement.classList.add( 'aw-splm-tableHeaderCellLabel', 'aw-splm-tableHeaderCellInner' );
        containerElement.textContent = localizedStrings.definedIn;
    }
}

function addIsUnconfiguredPropToVmos( contextUid, pmiVmos ) {
    if( contextUid && pmiVmos ) {
        const unconfiguredAssignedPMIs = epPropCacheSvc.getProperty( contextUid, wiPMIConstants.UNCONFIGURED_PMI );
        pmiVmos.forEach( ( pmiVmo ) => {
            const value = unconfiguredAssignedPMIs.indexOf( pmiVmo.uid ) > -1;
            const isUnconfiguredProp = {
                value,
                displayValue: value,
                propType: 'BOOLEAN',
                isArray: false
            };
            pmiVmo.props[ wiPMIConstants.PMI_IS_UNCONFIGURED_PSEUDO_PROP ] =
                vmoSvc.constructViewModelProperty( isUnconfiguredProp, wiPMIConstants.PMI_IS_UNCONFIGURED_PSEUDO_PROP, pmiVmo, false );
        } );
    }
}
function updateInspectionRevision( contexObj, selectedObjects ) {
    if( !Array.isArray( selectedObjects ) || selectedObjects.length === 0 || !contexObj.uid ) {
        return;
    }
    const targetInspectionRevs = [];
    selectedObjects.forEach( inspectionRev => {
        if( inspectionRev.props[ wiPMIConstants.PMI_IS_UNCONFIGURED_PSEUDO_PROP ].dbValue ) {
            targetInspectionRevs.push( inspectionRev.uid );
        }
    } );
    const updateToCharacteristics = targetInspectionRevs.map( pmiUid => epPropCacheSvc.getProperty( pmiUid, 'SourceCharacteristic' )[ 0 ] );
    if( targetInspectionRevs.length === updateToCharacteristics.length && updateToCharacteristics.length > 0 ) {
        const saveInputWriter = saveInputWriterService.get();
        saveInputWriter.updateAssignedPMIs( contexObj, targetInspectionRevs, updateToCharacteristics );
        const chxObjs = updateToCharacteristics.map( chxUid => cdm.getObject( chxUid ) );
        const relatedObject = [ ...selectedObjects, ...chxObjs, contexObj ];
        epSaveService.saveChanges( saveInputWriter, true, relatedObject );
    }
}
function updateVmoPseudoProps( vmo, definedInObjUid ) {
    const definedInModelObj = cdm.getObject( definedInObjUid );
    const values = definedInModelObj.props.object_string.dbValues;
    vmo.props[ wiPMIConstants.PMI_DEFINED_IN_COLUMN_PROPERTY_NAME ].dbValue = values[ 0 ];
    vmo.props[ wiPMIConstants.PMI_DEFINED_IN_COLUMN_PROPERTY_NAME ].uiValue = values[ 0 ];
    vmo.props[ wiPMIConstants.PMI_DEFINED_IN_COLUMN_PROPERTY_NAME ].value = values[ 0 ];
    vmo.props[ wiPMIConstants.PMI_IS_UNCONFIGURED_PSEUDO_PROP ].dbValue = false;
    vmo.props[ wiPMIConstants.PMI_IS_UNCONFIGURED_PSEUDO_PROP ].value = false;
}
function postPmiUpdateSyncPropsToVmos( assignedPmiVmos, saveEvents, pmiColumnConfiguration ) {
    if( Array.isArray( assignedPmiVmos ) && assignedPmiVmos.length > 0 && isDefinedInColumnConfigured( pmiColumnConfiguration ) ) {
        const whereDefinedEvents = saveEvents.filter( ( event ) => event.eventType === wiPMIConstants.PMI_WHERE_DEFINED_EVENT_NAME );
        whereDefinedEvents.forEach( ( event ) => {
            if( event.eventData[ 0 ] === wiPMIConstants.PMI_CONTEXT_PSEUDO_PROP ) {
                const vmoToUpdate = assignedPmiVmos.find( vmo => vmo.uid === event.eventObjectUid );
                updateVmoPseudoProps( vmoToUpdate, event.eventData[ 1 ] );
            }
        } );
    }
}
 function removeInspectionRevision( contexObj, selectedObjects ) {
    if( !Array.isArray( selectedObjects ) || selectedObjects.length === 0 || !contexObj.uid ) {
        return;
    }
    const saveInputWriter = saveInputWriterService.get();
    saveInputWriter.addRemoveAssignedPMIs( contexObj, undefined, selectedObjects );
    const relatedObject = [ ...selectedObjects, contexObj ];
    return epSaveService.saveChanges( saveInputWriter, true, relatedObject );
}

/**
 *
 * @param {Object} targetPmisDataProvider pmis DataProvider
 * @param {Array} selectedPmis selected Characteristic Objects
 */
 function selectAllAssociatedPmi( targetPmisDataProvider, selectedPmis ) {
    if( !Array.isArray( selectedPmis ) ) {
        selectedPmis = [ selectedPmis ];
    }
    if( !targetPmisDataProvider.viewModelCollection || selectedPmis.length === 0 ) {
        return;
    }

    const selectedAssociationIds = [];
    selectedPmis.forEach( ( pmi ) => {
        const associationId = getSelectedAssociationIds( pmi );
        if( associationId && selectedAssociationIds.indexOf( associationId ) === -1 ) {
            selectedAssociationIds.push( associationId );
        }
    } );
    const loadedPmiToSelect = [];
    targetPmisDataProvider.viewModelCollection.loadedVMObjects.forEach( ( pmi ) => {
        if( isPmiAssociationIdInList( pmi, selectedAssociationIds ) || getIndexOfVmoInVmoArray( selectedPmis, pmi ) > -1 ) {
            loadedPmiToSelect.push( pmi );
        }
    } );

    targetPmisDataProvider.selectionModel.setSelection( loadedPmiToSelect );
}

/**
 *
 * @param {ViewModelObject[]} vmoArray to be search in
 * @param {ViewModelObject} vmo to be searched for
 * @returns {number} -1/index of vmo
 */
function getIndexOfVmoInVmoArray( vmoArray, vmo ) {
    for ( let index = 0; index < vmoArray.length; index++ ) {
        if( vmo.uid === vmoArray[index].uid ) {
            return index;
        }
    }
    return -1;
}

/**
 *
 * @param {Object} pmi pmi vmo
 * @return {String} association Id if exist
 */
function getSelectedAssociationIds( pmi ) {
    const props = getPropsObjectWithAssociationProperties( pmi );
    if ( !props ) {
        return null;
    }

    if( isGroupableAssociationType( props[wiPMIConstants.MCI_PMI_ASSOCIATION_TYPE].dbValues[ 0 ] ) ) {
        return props[wiPMIConstants.MCI_PMI_ASSOCIATION_ID].dbValues[ 0 ];
    }
    return null;
}

/**
 *
 * @param {Object} pmi pmi vmo
 * @param {Array} associationIds association Ids of selected pmi
 * @return {boolean} true/false
 */
function isPmiAssociationIdInList( pmi, associationIds ) {
    const props = getPropsObjectWithAssociationProperties( pmi );
    if( !props ) {
        return false;
    }
    if( associationIds.indexOf( props[wiPMIConstants.MCI_PMI_ASSOCIATION_ID].dbValues[ 0 ] ) > -1 ) {
        return true;
    }

    return false;
}

/**
 *
 * @param {Object} pmi pmi vmo
 * @return {Object} props object if exist
 */
function getPropsObjectWithAssociationProperties( pmi ) {
    let props = null;
    if( pmi.props[wiPMIConstants.MCI_PMI_ASSOCIATION_TYPE] !== undefined ) {
        props = pmi.props;
    } else {
        const metaUid = pmi.props[wiPMIConstants.MCI_PMI_META_DATA].dbValues[0];
        if( metaUid ) {
            const metaObj = cdm.getObject( metaUid );
            if( metaObj.props[wiPMIConstants.MCI_PMI_ASSOCIATION_TYPE] !== undefined ) {
                props = metaObj.props;
            }
        }
    }
    return props;
}

export default{
    loadAssemblyPmis,
    loadAssignedPmis,
    assignPmisToCurrentContext,
    handleAddRemoveInspections,
    addDefindInPropToVmos,
    postSaveAddDefindInPropToVmos,
    renderDefinedIn,
    addIsUnconfiguredPropToVmos,
    updateInspectionRevision,
    postPmiUpdateSyncPropsToVmos,
    removeInspectionRevision,
    selectAllAssociatedPmi
};
