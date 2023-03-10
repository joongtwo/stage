// Copyright (c) 2022 Siemens

import _ from 'lodash';
import constantsService from 'soa/constantsService';
import dateTimeService from 'js/dateTimeService';

/**
 * Method checks for the BO Constant's Value(Prg0MaintainGapForRelatedEvents)
 * If the BO Constant is present in the cache , then it returns its value.
 * If the BO Constant is not present , then it gets the constant's value and then adds it to the cache to be read at later stage.
 * @param {object} shiftSecondary - Shift Secondary events checkbox on the Shift Event panel
 *
 */
export let checkAndSetBOConstantValue = function( selectedEvent, shiftSecondary ) {
    let typeName = selectedEvent.modelType.name;
    let constantName = 'Prg0MaintainGapForRelatedEvents';
    //Check if cache contains the value of the BO Constant
    let boConstantValue = constantsService.getConstantValue( typeName, constantName );
    let newPgp0ShiftSecondary = _.clone( shiftSecondary );
    //If BO Constant value is not cached , then make the call to get the value
    if( boConstantValue === null ) {
        let getBOConstantValue = [];
        getBOConstantValue.push( {
            typeName: typeName,
            constantName: constantName
        } );
        constantsService.getTypeConstantValues( getBOConstantValue ).then( function( response ) {
            if( response && response.constantValues && response.constantValues.length > 0 ) {
                boConstantValue = response.constantValues[ 0 ].value;
                newPgp0ShiftSecondary.update( stringToBool( boConstantValue ) );
            }
        } );
    } else {
        newPgp0ShiftSecondary.update( stringToBool( boConstantValue ) );
    }
};

let stringToBool = function( constantValue ) {
    if( constantValue === 'true' ) {
        return true;
    }
    if( constantValue === 'false' ) {
        return false;
    }
};

/**
 *
 * @param {object} data - Contains the data of the Event and its new date
 * This functions formats the date
 *
 */
export let formatNewEventDate = function( Pgp0NewPlannedDate, eventData, eventObj ) {
    var dateValue;
    //When reading the new date from Shift Event panel
    if( Pgp0NewPlannedDate && Pgp0NewPlannedDate.dbValue ) {
        if( eventObj.props.prg0PlannedDate ) {
            let plannedDate = new Date( eventObj.props.prg0PlannedDate.dbValues[ 0 ] );
            let newPlannedDate = new Date( Pgp0NewPlannedDate.displayValues[ 0 ] );
            //Setting the time from old date to new date
            newPlannedDate.setHours( plannedDate.getHours() );
            newPlannedDate.setMinutes( plannedDate.getMinutes() );
            dateValue = dateTimeService.formatUTC( newPlannedDate );
        }
    }
    //When event is dragged on Timeline while secondary events are present
    else if( eventData.plannedDate ) {
        dateValue = dateTimeService.formatUTC( eventData.plannedDate );
    }
    //When event is dragged on Timeline while no secondary events are present
    else if( eventData.updateTaskInfo.plannedDate ) {
        dateValue = dateTimeService.formatUTC( eventData.updateTaskInfo.plannedDate );
    }
    return dateValue;
};

/**
 *
 * @param {data} data - Contains value set in the shift event panel
 * This functions returns the checkbox value from Shift Event Panel
 * If checkbox is not visible , then set nothing
 */
export let getUpdateSecondaryEventsFlag = function( Pgp0ShiftSecondary ) {
    //If event has secondary events then returns the value set in the checkbox
    if( Pgp0ShiftSecondary ) {
        return Pgp0ShiftSecondary.dbValue;
    }
    //If event has no secondary events then return empty and read from BO Constant
    return;
};

export default {
    checkAndSetBOConstantValue,
    formatNewEventDate,
    getUpdateSecondaryEventsFlag
};
