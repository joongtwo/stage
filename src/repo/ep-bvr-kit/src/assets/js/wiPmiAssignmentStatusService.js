// Copyright (c) 2022 Siemens

import wiPMIConstants from 'js/wiPMIConstants';
import epLoadInputHelper from 'js/epLoadInputHelper';
import epLoadService from 'js/epLoadService';
import epObjectPropertyCacheService from 'js/epObjectPropertyCacheService';
import vmoSvc from 'js/viewModelObjectService';
import mfeTypeUtils from 'js/utils/mfeTypeUtils';
import mfeViewModelUtils from 'js/mfeViewModelUtils';
import epToggleService from 'js/epToggleService';
import popupSvc from 'js/popupService';
import dmsSvc from 'soa/dataManagementService';
import localeSvc from 'js/localeService';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import epMissingInSrcIndicationTablePropertyRenderer from 'js/epMissingInSrcIndicationTablePropertyRenderer';
import { getBaseUrlPath } from 'app';
import epContextService from 'js/epContextService';
import cdm from 'soa/kernel/clientDataModel';
import AwPromiseService from 'js/awPromiseService';
import { renderComponent } from 'js/declReactUtils';
import { includeComponent } from 'js/moduleLoader';

/**
 * WI PMI service
 *
 * @module js/wiPmiAssignmentStatusService
 */

const pmiLocalizedMsgs = localeSvc.getLoadedText( 'wiPmiMessages' );
const localizedMsgs = localeSvc.getLoadedText( 'assignmentIndicationMessages' );
const meopPropPolicy = {
    types: [ {
        name: 'MEOPRevision',
        properties: [ {
            name: 'object_name'
        } ]
    } ]
};

const TABLE_CELL_IMAGE_VIEW = 'MfeTableCellImage';
const TOOLTIP_VIEW = 'MfeGenericTooltip';
const TABLE_CELL_IMAGE_TOOLTIP_CLASS = 'aw-epAssignmentIndication-tableCellImageTooltip';

/**
 * loading all the updated vmos with the assignment status property
 *
 * @param {string} contextProcessUid - the page context uid
 * @param {ViewModelObject[]} vmos - the VMOs array
 * @param {boolean} toggleValue - the show consumption indication toggle value
 * @returns {Promise} Promise object
 */
function loadAssignmentStatusData( contextProcessUid, vmos, toggleValue ) {
    createAssignmentStatusProperty( vmos );
    if( toggleValue ) {
        const uidsWithNoCachedStatus = vmos.map( ( vmo ) => vmo.uid );
        if( uidsWithNoCachedStatus.length > 0 ) {
            return loadAssignmentStatusFromServer( contextProcessUid, uidsWithNoCachedStatus );
        }
    } else {
        vmos.forEach( ( vmo ) => mfeViewModelUtils.updatePropValue( vmo, wiPMIConstants.ASSIGNMENT_INDICATION_STATUS_PROP, wiPMIConstants.ASSIGNMENT_INDICATION_STATUS_PROP_VALUES.NOT_ASSIGNED ) );
    }
    return new Promise( ( resolve ) => {
        resolve( [] );
    } );
}

/**
 * This method takes Array of VMOs and updates each VMO's assignmentIndicationProp value.
 * @param { ObjectArray } vmos: ViewModelObjects to update
 * @param { Boolean } toggleValue: If Indication toggle is on/off
 */
function updatePmisAssignemntStatus( vmos, toggleValue ) {
    if( Array.isArray( vmos ) && toggleValue ) {
        vmos.forEach( ( vmo ) => {
            updatePMIAssignemntStatus( vmo );
        } );
    }
}

/**
 * This method takes Array of VMOs and updates each VMO's assignmentIndicationProp value.
 * @param { ObjectArray } vmos: ViewModelObjects to update
 * @param { Array } pmiUids: updatable PMI uid
 * @param { Boolean } toggleValue: If Indication toggle is on/off
 */
function updatePmisAssignemntStatusbyUids( vmos, pmiUids, toggleValue ) {
    if( Array.isArray( vmos ) && Array.isArray( pmiUids ) && pmiUids.length > 0 && toggleValue ) {
        vmos.forEach( ( vmo ) => {
            if( pmiUids.indexOf( vmo.uid ) > -1 ) {
                updatePMIAssignemntStatus( vmo );
            }
        } );
    }
}

/**
 * updating the assignmentStatus prop
 *
 * @param {ViewModelObject} vmo - the ViewModelObject
 */
function updatePMIAssignemntStatus( vmo ) {
    if( mfeTypeUtils.isOfType( vmo, wiPMIConstants.MCI_PMI_CHARACTERISTIC ) && vmo.props[ wiPMIConstants.ASSIGNMENT_INDICATION_STATUS_PROP ] ) {
        const assignmentStatus = getCachedStatus( vmo );
        const isToggleOn = epToggleService.getGlobalAssignmentIndicationToggleValue();
        mfeViewModelUtils.updatePropValue( vmo, wiPMIConstants.ASSIGNMENT_INDICATION_STATUS_PROP, assignmentStatus && isToggleOn ?
            assignmentStatus : wiPMIConstants.ASSIGNMENT_INDICATION_STATUS_PROP_VALUES.NOT_ASSIGNED );
    }
}

/**
 * @param {ViewModelObject} vmo - a given vmo
 * @return {string} the assignment status
 */
function getCachedStatus( vmo ) {
    const assignmentStatus = epObjectPropertyCacheService.getProperty( vmo.uid, wiPMIConstants.PMI_ASSIGNMENT_INFO_PSEUDO_PROP );
    return assignmentStatus ? assignmentStatus[ 0 ] : null;
}

/**
 * adding the prop assignmentStatus to the vmos
 *
 * @param {ViewModelObject[]} vmos - the VMOs array
 */
function createAssignmentStatusProperty( vmos ) {
    vmos.forEach( ( vmo ) => {
        if( !vmo.props[ wiPMIConstants.ASSIGNMENT_INDICATION_STATUS_PROP ] ) {
            const value = getCachedStatus( vmo ) || wiPMIConstants.ASSIGNMENT_INDICATION_STATUS_PROP_VALUES.NOT_ASSIGNED;
            const assignmentStatusObj = {
                value,
                displayValue: value,
                propType: 'STRING'
            };
            vmo.props[ wiPMIConstants.ASSIGNMENT_INDICATION_STATUS_PROP ] = vmoSvc.constructViewModelProperty( assignmentStatusObj, wiPMIConstants.ASSIGNMENT_INDICATION_STATUS_PROP, vmo, false );
        }
    } );
}

/**
 * rendering the consumption indication according to the assignmentStatus prop
 *
 * @param {ViewModelObject} vmo - a given ViewModelObject
 * @param {Object} containerElement - the icon container element
 */
function renderPmiAssignmentStatusIndication( vmo, containerElement ) {
    const assignmentStatusValue = vmo.props.assignmentStatus && vmo.props.assignmentStatus.dbValue;
    let imageName;
    switch ( assignmentStatusValue ) {
        case wiPMIConstants.ASSIGNMENT_INDICATION_STATUS_PROP_VALUES.ASSIGNED_IN_CURRENT_SCOPE:
            imageName = 'indicatorAssigned16';
            break;
        case wiPMIConstants.ASSIGNMENT_INDICATION_STATUS_PROP_VALUES.ASSIGNED_IN_OTHER_SCOPE:
            imageName = 'indicatorAssignedInOtherProcess16';
            break;
        case wiPMIConstants.ASSIGNMENT_INDICATION_STATUS_PROP_VALUES.MULTIPLE_ASSIGNED_IN_CURRENT_SCOPE:
            imageName = 'indicatorMultipleAssignments16';
            break;
        case wiPMIConstants.ASSIGNMENT_INDICATION_STATUS_PROP_VALUES.MULTIPLE_ASSIGNED_IN_OTHER_SCOPE:
            imageName = 'indicatorExternalMultipleAssignments16';
            break;
        default:
            break;
    }
    if ( imageName ) {
        const tooltipData = getAssignmentIndicationTooltipData( assignmentStatusValue );
        const props = {
            imageSrc: imageName,
            tooltipView: TOOLTIP_VIEW,
            tooltipData,
            isClickable: true
        };
        const imageElement = includeComponent( TABLE_CELL_IMAGE_VIEW, props );
        containerElement.addEventListener('click', () => showAssignedInPopup( vmo, containerElement.parentElement ), false);
        renderComponent( imageElement, containerElement );
    }
}

/**
 *
 * @param {string} status - the assignment status
 * @returns {Object} tooltip data
 */
function getAssignmentIndicationTooltipData( status ) {
    let title = '';
    let instruction = '';
    switch (status) {
        case wiPMIConstants.ASSIGNMENT_INDICATION_STATUS_PROP_VALUES.ASSIGNED_IN_CURRENT_SCOPE:
            title = localizedMsgs.singleConsumptionInScopeTooltipText;
            instruction = localizedMsgs.clickDescription;
            break;
        case wiPMIConstants.ASSIGNMENT_INDICATION_STATUS_PROP_VALUES.ASSIGNED_IN_OTHER_SCOPE:
            title = localizedMsgs.singleConsumptionOutOfScopeTooltipText;
            break;
        case wiPMIConstants.ASSIGNMENT_INDICATION_STATUS_PROP_VALUES.MULTIPLE_ASSIGNED_IN_CURRENT_SCOPE:
            title = localizedMsgs.multipleConsumptionInScopeTooltipText;
            instruction = localizedMsgs.clickDescription;
            break;
        case wiPMIConstants.ASSIGNMENT_INDICATION_STATUS_PROP_VALUES.MULTIPLE_ASSIGNED_IN_OTHER_SCOPE:
            title = localizedMsgs.multipleConsumptionOutOfScopeTooltipText;
            break;
        default:
            break;
    }
    return {
        extendedTooltip: {
            title,
            instruction,
            className: TABLE_CELL_IMAGE_TOOLTIP_CLASS
        }
    };
}

/**
 *
 * @param {string} contextProcessUid - the context in which we are loading
 * @param {string[]} uids - a given array of uids to get the assignment status for
 * @returns {Promise} Promise object
 */
function loadAssignmentStatusFromServer( contextProcessUid, uids ) {
    if( Array.isArray( uids ) && uids.length > 0 ) {
        const characteristics = [ {
            tagName: 'characteristics',
            attributeName: 'objectUid',
            attributeValue: uids
        } ];
        const loadInputTypes = epLoadInputHelper.getLoadTypeInputs( [ wiPMIConstants.PMI_ASSIGNMENT_INFO_LOAD_TYPE ], [ contextProcessUid ], '', '', characteristics );
        return epLoadService.loadObject( loadInputTypes, false );
    }
    return AwPromiseService.instance.resolve( [] );
}

/**
 * The function uses the popup service to show the assigned in operation popup for a specific vmo
 *
 * @param {ViewModelObject} vmo - a given ViewModelObject
 * @param {DOMElement} reference - the reference of the popup
 */
function showAssignedInPopup( vmo, reference ) {

    let inScopeList = [];
    let outOfScopeList = [];
    getObjectsAssignedToInScope( vmo ).then(
        ( inScopeResult ) => {
            inScopeList = inScopeResult;
            getObjectsAssignedToOutOfScope( vmo ).then(
                ( outScopeResult ) => {
                    outOfScopeList = outScopeResult;
    
                    const PopupData = {
                        options: {
                            view: 'WiAssignedInOperationsPopup',
                            reference,
                            placement: 'bottom-start',
                            whenParentScrolls: 'close',
                            subPanelContext: {
                                inScope: inScopeList,
                                outOfScope: outOfScopeList,
                                disableAssignedToOutOfScopeList: false
                            }
                        }
                    };
                    popupSvc.show( PopupData );
                }
            );
        }
    );
}

/**
 *
 * @param {ViewModelObject} vmo -a  given vmo
 * @param {string} pseudoProp - a pseudo property name
 * @return {Promise<VMO[]>} a promise which is resolved to a vmo array
 */
function getObjectsAssignedTo( vmo, pseudoProp ) {
    const meopPolicyId = propPolicySvc.register( meopPropPolicy );
    const uidsAssignedToArray = epObjectPropertyCacheService.getProperty( vmo.uid, pseudoProp );
    if( Array.isArray( uidsAssignedToArray ) && uidsAssignedToArray.length > 0 ) {
        return dmsSvc.loadObjects( uidsAssignedToArray ).then(
            () => {
                propPolicySvc.unregister( meopPolicyId );
                return uidsAssignedToArray.map( ( uid ) => {
                    const relatedPmiObject = cdm.getObject( vmo.uid );
                    const additionalData = {
                        relatedPmiObject
                    };
                    return {
                        vmo: vmoSvc.createViewModelObject( uid ),
                        additionalData: additionalData
                    };
                } );
            }
        );
    }
    return new Promise( ( resolve ) => {
        resolve( [] );
    } );
}

/**
 * getting an array of objects that the pmi is assigned to in this scope
 *
 * @param {ViewModelObject} vmo - a given ViewModelObject
 * @return {Promise<ViewModelObject[]>} - vmos of the objects the pmi is assigned to
 */
function getObjectsAssignedToInScope( vmo ) {
    return getObjectsAssignedTo( vmo, wiPMIConstants.PMI_ASSIGNED_IN_CURRENT_SCOPE_PSEUDO_PROP );
}

/**
 * getting an array of objects that the pmi is assigned to out of the scope
 *
 * @param {ViewModelObject} vmo - a given ViewModelObject
 * @return {Promise<ViewModelObject[]>} - vmos of the objects the pmi is assigned to
 */
function getObjectsAssignedToOutOfScope( vmo ) {
    return getObjectsAssignedTo( vmo, wiPMIConstants.PMI_ASSIGNED_IN_OTHER_SCOPE_PSEUDO_PROP );
}

/**
 * Render Missing In Source indication.
 * Appends icon image to the container element .
 *
 * @param {Object} vmo - the vmo for the cell
 * @param {DOMElement} containerElement - the container element
 */
function rendererMissingInSourceOrChangeIndication( vmo, containerElement ) {
    if( !containerElement ) {
        return;
    }

    const changeInSrc = epObjectPropertyCacheService.getProperty( vmo.uid, 'ChangeIndication' );
    if( changeInSrc && changeInSrc[ 0 ] === 'Mismatched' ) {
        renderMismatchedPmiProperty( vmo, containerElement );
    } else {
        epMissingInSrcIndicationTablePropertyRenderer.rendererMissingInSourceOrChangeIndication( vmo, containerElement );
    }
}

/**
 * Render mismatched Pmi indication
 * @param {Object} vmo - the vmo for the cell
 * @param {DOMElement} containerElement - the container element
 */
function renderMismatchedPmiProperty( vmo, containerElement ) {
    let title = pmiLocalizedMsgs.impactedPmi.replace( '{0}', vmo.props.mci0PmiDescription.uiValue );
    let instruction = '';
    const tooltipData = {
        extendedTooltip: {
            title,
            instruction,
            className: TABLE_CELL_IMAGE_TOOLTIP_CLASS
        }
    };
    const props = {
        imageSrc: 'indicatorMismatch16',
        tooltipView: TOOLTIP_VIEW,
        tooltipData,
        isClickable: true
    };
    const imageElement = includeComponent(TABLE_CELL_IMAGE_VIEW, props);
    renderComponent(imageElement, containerElement);
}

/**
 *
 * @param {String} objUid selected object uid
 * @returns {boolean} ture/false
 */
function hasMismatchedPmi( objUid ) {
    let hasMismatchedPmi = false;
    if( objUid ) {
        const pageContext = epContextService.getPageContext();
        if( pageContext && pageContext.loadedObject ) {
            const assignedPmiPropObj = cdm.getObject( objUid ).props.epw0Inspections;
            if( assignedPmiPropObj && assignedPmiPropObj.dbValues.length > 0 ) {
                for( const pmiUid of assignedPmiPropObj.dbValues ) {
                    const changeInSrc = epObjectPropertyCacheService.getProperty( pmiUid, 'ChangeIndication' );
                    if( changeInSrc && changeInSrc[ 0 ] === 'Mismatched' ) {
                        hasMismatchedPmi = true;
                        break;
                    }
                }
            }
        }
    }

    return hasMismatchedPmi;
}

/**
 *
 * @param {String} objUid selected object uid
 * @returns {boolean} ture/false
 */
function hasMissingInSrcPmi( objUid ) {
    let hasMissingInSrc = false;
    if( objUid ) {
        const pageContext = epContextService.getPageContext();
        if( pageContext && pageContext.loadedObject ) {
            const contextObjectUid = pageContext.loadedObject.uid;
            const missingInSrcObject = epObjectPropertyCacheService.getProperty( contextObjectUid, 'accountabilityResponse' ).missingInSrc;
            const assignedPmiPropObj = cdm.getObject( objUid ).props.epw0Inspections;
            if( missingInSrcObject && missingInSrcObject.length > 0 && assignedPmiPropObj ) {
                for( let missingObj of missingInSrcObject ) {
                    if( assignedPmiPropObj.dbValues.indexOf( missingObj.uid ) > -1 ) {
                        hasMissingInSrc = true;
                        break;
                    }
                }
            }
        }
    }
    return hasMissingInSrc;
}

/**
 *
 * @param {Object} targetPmisDataProvider pmis DataProvider
 * @param {Array} selectedPmis selected Characteristic Objects
 */
 function syncToPmiTable( targetPmisDataProvider, selectedPmis ) {
    if( !targetPmisDataProvider.viewModelCollection ) {
        return;
    }
    if( !Array.isArray( selectedPmis ) ) {
        selectedPmis = [ selectedPmis ];
    }

    const selectedMetaObjects = selectedPmis.map( chx => chx.props.mci0pmiMetaData.dbValues[0] );
    const loadedPmi = targetPmisDataProvider.viewModelCollection.loadedVMObjects;
    const loadedPmiToSelect = loadedPmi.filter( pmi => selectedMetaObjects.indexOf( pmi.props.mci0pmiMetaData.dbValues[0] ) > -1 );

    if( loadedPmiToSelect.length === 0 ) {
        targetPmisDataProvider.selectionModel.selectNone();
        return;
    }

    targetPmisDataProvider.selectionModel.setSelection( loadedPmiToSelect );
}

export default {
    loadAssignmentStatusData,
    updatePmisAssignemntStatus,
    updatePmisAssignemntStatusbyUids,
    updatePMIAssignemntStatus,
    renderPmiAssignmentStatusIndication,
    loadAssignmentStatusFromServer,
    getObjectsAssignedToInScope,
    getObjectsAssignedToOutOfScope,
    hasMissingInSrcPmi,
    rendererMissingInSourceOrChangeIndication,
    hasMismatchedPmi,
    syncToPmiTable
};
