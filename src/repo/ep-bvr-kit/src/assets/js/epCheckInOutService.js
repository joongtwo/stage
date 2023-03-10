// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for Check-In and Check-Out
 *
 * @module js/epCheckInOutService
 */
import { constants as epSaveConstants } from 'js/epSaveConstants';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import saveInputWriterService from 'js/saveInputWriterService';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import epSessionService from 'js/epSessionService';
import cdm from 'soa/kernel/clientDataModel';
import epSaveService from 'js/epSaveService';


/**
 * Check-in / Check-out modeObject
 *
 * @param {ModelObject} objToCheckOut - the object to check-out
 * @param {Object} objectsToModifyEntry - the ObjectsToModify section entries for the save input
 */
export function checkInOut( objToCheckOut, objectsToModifyEntry ) {
    // Start section to remove once moved to the server response //
    const policy = {
        types: [ {
            name: 'ImanItemBOPLine',
            properties: [ {
                name: 'bl_rev_object_name'
            },
            {
                name: 'bl_parent'
            },
            {
                name: 'bl_rev_checked_out_user'
            },
            {
                name: 'bl_rev_checked_out'
            }
            ]
        } ]
    };
    propPolicySvc.register( policy );
    // End section to remove once moved to the server response //

    epSessionService.setBalancingScope( objToCheckOut );
    let saveInputWriter = saveInputWriterService.get();
    saveInputWriter.addEntryToSection( epSaveConstants.OBJECTS_TO_MODIFY, objectsToModifyEntry );
    epSaveService.saveChanges( saveInputWriter, false, [ objToCheckOut ] );
}

/**
 * Get the Checked-out parent to populate the check-in confirmation message input
 *
 * @param {String} checkedOutObject - Checked-out object
 *
 * @return {String} the Checked-out parent name
 */
export function getParentOfCheckedOutObject( checkedOutObject ) {
    let loadedObject = checkedOutObject.uid;
    let status = checkedOutObject.props[ epBvrConstants.BL_REV_CHECKED_OUT ].dbValues[ 0 ];
    let previousObject = cdm.getObject( loadedObject );
    while( status === 'Y' ) {
        let parent = cdm.getObject( loadedObject );
        if( parent ) {
            status = parent.props[ epBvrConstants.BL_REV_CHECKED_OUT ].dbValues[ 0 ];
            if( status === ' ' ) {
                return previousObject.props[ epBvrConstants.BL_REV_OBJECT_NAME ].dbValues[ 0 ];
            }
        } else{
            return previousObject.props[ epBvrConstants.BL_REV_OBJECT_NAME ].dbValues[ 0 ];
        }
        previousObject = cdm.getObject( loadedObject );
        loadedObject = parent.props[ epBvrConstants.BL_PARENT ].dbValues[ 0 ];
    }
    return previousObject;
}

let exports;
export default exports = {
    checkInOut,
    getParentOfCheckedOutObject
};
