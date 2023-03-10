// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for rendering epProcessResourceListForAssignPopupService
 *
 * @module js/epProcessResourceListForAssignPopupService
 */

import cdm from 'soa/kernel/clientDataModel';
import epSaveService from 'js/epSaveService';
import epBvrObjectService from 'js/epBvrObjectService';
import saveInputWriterService from 'js/saveInputWriterService';
import mfeVMOService from 'js/services/mfeViewModelObjectLifeCycleService';


/**
 * @param {Object} inputObj the selected tile. Might be the station or a process resource in the station
 * @param {ObjectList} operations the selected operations
 *
 * @returns {Object} the station and process resource list
 */
export function getStationAndProcessResourceList( inputObj, operations ) {
    // inputObj might be the station or a process resource in the station
    let station = inputObj;
    let prList;
    // If inputObj is a process resource that was selected in the station tile
    if( inputObj.modelType.typeHierarchyArray.indexOf( 'Mfg0BvrProcessResource' ) > -1 ) {
        // Get the station of the process resource
        station = epBvrObjectService.getParent( inputObj );
        const stationPRs = station.props.Mfg0processResources.dbValues;
        // Remove the process resource that was selected in the station tile from the process resource list
        const filteredStationPRs = stationPRs.filter( prUid => prUid !== inputObj.uid );
        prList = filteredStationPRs.map( prUid => mfeVMOService.createViewModelObjectFromModelObject( cdm.getObject( prUid ) ) );
        // Add the station for unAssign entry
        prList.push( mfeVMOService.createViewModelObjectFromModelObject( cdm.getObject( station.uid ) ) );
    } else {
        // The inputObj is the station or not assigned tile was selected in the station tile
        const firstOperationPr = operations[0].props.Mfg0processResource.dbValue;
        const filterOperationsByPr = operations.filter( operation => operation.props.Mfg0processResource.dbValue !== firstOperationPr );
        const stationPRs = station.props.Mfg0processResources.dbValues;
        // The selected operations have different process resources assignment
        if( filterOperationsByPr.length > 0 ) {
            // Add all the process resources to the list
            prList = stationPRs.map( prUid => mfeVMOService.createViewModelObjectFromModelObject( cdm.getObject( prUid ) ) );
            // Add the station for unAssign entry
            prList.push( mfeVMOService.createViewModelObjectFromModelObject( cdm.getObject( station.uid ) ) );
        } else if ( firstOperationPr === station.uid || firstOperationPr === '' || firstOperationPr === null ) { // Check if all selected operations are unassigned
            // Add all the process resources to the list
            prList = stationPRs.map( prUid => mfeVMOService.createViewModelObjectFromModelObject( cdm.getObject( prUid ) ) );
        } else { // All operations are assigned to the same process resource
            // Remove the process resource that is assigned to all selected operations
            const filteredStationPRs = stationPRs.filter( prUid => prUid !== firstOperationPr );
            prList = filteredStationPRs.map( prUid => mfeVMOService.createViewModelObjectFromModelObject( cdm.getObject( prUid ) ) );
            // Add the station for unAssign entry
            prList.push( mfeVMOService.createViewModelObjectFromModelObject( cdm.getObject( station.uid ) ) );
        }
    }
    return {
        station,
        prList
    };
}

/**
 * Set the process resource/ station as the parent of the selected operations
 *
 * @param {Object} processResource - the process resource/ station object
 * @param {ObjectList} operations - the operations to be assigned to the process resource/ station
 *
 * @returns {Promise} the promise
 */
export function assignOperationsToProcessResource( processResource, operations ) {
    const saveInputWriter = saveInputWriterService.get();

    // Add reassign input
    operations.forEach( operation => {
        saveInputWriter.addMoveObject( { id: [ operation.uid ] }, { bl_parent: [ processResource.uid ] } );
    } );

    // Add related objects
    const relatedObjects = [ processResource, ...operations ];
    saveInputWriter.addRelatedObjects( relatedObjects );

    return epSaveService.saveChanges( saveInputWriter, true, relatedObjects );
}

export default {
    getStationAndProcessResourceList,
    assignOperationsToProcessResource
};
