// Copyright (c) 2022 Siemens

/**
 * Set Occurrence type Service for EasyPlan.
 *
 * @module js/epSetOccurrenceTypeService
 */
import _ from 'lodash';
import epLoadService from 'js/epLoadService';
import epLoadInputHelper from 'js/epLoadInputHelper';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import popupService from 'js/popupService';
import localeSvc from 'js/localeService';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import cdm from 'soa/kernel/clientDataModel';
import { constants as epBvrConstants } from 'js/epBvrConstants';

const detailsMessagePath = '/i18n/DetailsMessages';

/**
 * Open Set Occurrence type Pop-up
 *
 * @param {object} selectedObjects - selectedObject
 * @param {object} parentObject - parentObject
 */
export function openSetOccurrenceTypePopup( selectedObjects, parentObject ) {
    const setOccTypeData = {};
    getOccurrenceTypesData( selectedObjects[ 0 ] ).then( function( occTypes ) {
        setOccTypeData.occTypes = occTypes;
        setOccTypeData.selectedObject = selectedObjects[ 0 ];
        setOccTypeData.parentObject = parentObject;
        showSetOccurrenceTypePopup( setOccTypeData );
    } );
}

function showSetOccurrenceTypePopup( setOccTypeData ) {
    const resource = localeSvc.getLoadedText( detailsMessagePath );
    const popupParams = {
        declView: 'EpSetOccurrenceType',
        locals: {
            anchor: 'mfeModalPopupCommandAnchor',
            caption: resource.setOccurrenceType
        },
        options: {
            height: 376,
            width: 400,
            clickOutsideToClose: false,
            draggable: true
        },
        subPanelContext: {
            setOccTypeData: setOccTypeData
        }
    };
    popupService.show( popupParams );
}

function getOccurrenceTypesData( selectedObject ) {
    const loadTypes = [ epLoadConstants.GET_OCCURRENCE_TYPE, epLoadConstants.GET_PROPERTIES ];
    const loadTypeInputs = epLoadInputHelper.getLoadTypeInputs( loadTypes, selectedObject.uid, [ epBvrConstants.BL_OCC_TYPE ] );
    return epLoadService.loadObject( loadTypeInputs, false ).then( function( response ) {
        let occTypes = [];
        const occTypesMap = response.relatedObjectsMap.OccurrenceTypes.additionalPropertiesMap2;
        for( let key in occTypesMap ) {
            occTypes.push( {
                propInternalValue: key,
                propDisplayValue: occTypesMap[ key ][ 0 ],
                isEditable: false
            } );
        }

        const updatedObject = cdm.getObject( selectedObject.uid );
        const currentOccType = updatedObject.props.bl_occ_type.dbValues[ 0 ];

        //Bring current occ type on top of list
        return _.sortBy( occTypes, ( occType ) => {
            return occType.propInternalValue !== currentOccType;
        } );
    } );
}

export function setOccurrenceType( selectedObject, occurrenceType, parentObject ) {
    const saveInputWriter = saveInputWriterService.get();
    let relatedObjects = [];

    //Check for revise for parent of consumed part.
    const parentObj = cdm.getObject( parentObject.uid );
    saveInputWriter.addReviseInput( parentObj );
    relatedObjects.push( parentObj );

    relatedObjects.push( selectedObject );
    saveInputWriter.addModifiedProperty( selectedObject.uid, epBvrConstants.BL_OCC_TYPE, [ occurrenceType ] );
    epSaveService.saveChanges( saveInputWriter, true, relatedObjects ).then( function( response ) {
        popupService.hide();
    } );
}

/**
 * Update the viewModel object to have occurrence types LOV
 *
 * @param {Object} vmo
 */
export function attachOccTypesLOV( vmo ) {
    const blOccTypeProp = vmo.props.bl_occ_type;

    blOccTypeProp.hasLov = true;
    blOccTypeProp.isSelectOnly = true;
    blOccTypeProp.isEditable = true;
    blOccTypeProp.emptyLOVEntry = false;

    blOccTypeProp.lovApi = {};
    blOccTypeProp.lovApi.getInitialValues = function( filterStr, deferred ) {
        return deferred.resolve( getOccurrenceTypesData( blOccTypeProp.dbValue, vmo ) );
    };

    blOccTypeProp.lovApi.getNextValues = function( deferred ) {
        deferred.resolve( null );
    };
    blOccTypeProp.lovApi.validateLOVValueSelections = function( lovEntries ) {
        blOccTypeProp.dbValues = [ lovEntries[ 0 ].propInternalValue ];
    };
}

const exports = {
    openSetOccurrenceTypePopup,
    setOccurrenceType,
    attachOccTypesLOV
};

export default exports;
