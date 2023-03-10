// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Ewi0EditDCDService
 */
import dateTimeSvc from 'js/dateTimeService';
import listBoxSvc from 'js/listBoxService';

var exports = {};

/**
  * Update the data object
  *
  * @param {Object} selectedObj the selected object in scope
  * @param {Object} dcdComment the dcdComment object
  *  * @param {Object} dcdDouble the dcdDouble object
  * @param {Object} dcdInteger the dcdInteger object
  *  * @param {Object} dcdBoolean the dcdBoolean object
  * @param {Object} dcdLov the dcdLov object
  *  * @param {Object} dcdDateTime the dcdDateTime object
  * @param {Object} dcdString the dcdString object
  *  * @param {Object} dcdBooleanListIn the dcdBooleanListIn object
  */
export function updatePanelData( selectedObj, dcdComment, dcdDouble, dcdInteger, dcdBoolean, dcdLov, dcdDateTime, dcdString, dcdBooleanListIn ) {
    let oldValue;
    let oldTimeValue;
    let dcdCommentData = { ...dcdComment };
    let dcdDoubleData = { ...dcdDouble };
    let dcdIntegerData = { ...dcdInteger };
    let dcdBooleanData = { ...dcdBoolean };
    let dcdLovData = { ...dcdLov };
    let dcdDateTimeData = { ...dcdDateTime };
    let dcdStringData = { ...dcdString };
    let dcdTypeData;

    //Comment
    dcdCommentData.propertyDisplayName = selectedObj.props.ewi0ExecutionComment.propertyDisplayName;
    selectedObj.oldComment = selectedObj.props.ewi0ExecutionComment.dbValue;
    dcdCommentData.dbValue = selectedObj.oldComment;
    dcdCommentData.uiValue = selectedObj.oldComment;

    //DataTypes
    dcdTypeData = selectedObj.props.mes0DCDType.displayValues[ 0 ];
    oldValue = selectedObj.props.ewi0DCExecutionValue.displayValues[ 0 ];

    const ewi0DCExecutionValue = selectedObj.props.ewi0DCExecutionValue.displayValues[ 0 ];
    const strRequired = selectedObj.props.mes0DCDIsOptional.displayValues[ 0 ];
    const isRequired = strRequired.toLowerCase() === 'true';
    const requiredText = isRequired ? 'Required' : '';

    const propName = selectedObj.props.ewi0DCExecutionValue.propertyDisplayName;
    const propValue = ewi0DCExecutionValue;
    let dcdBooleanList;
    let dcdlovList;

    if( dcdTypeData === 'Real Number Data Collection' ) {
        dcdDoubleData.dbValue = Number( propValue );
        dcdDoubleData.propertyDisplayName = propName;
        dcdDoubleData.isRequired = isRequired;
        dcdDoubleData.propertyRequiredText = requiredText;
    } else if( dcdTypeData === 'Integer Data Collection' ) {
        dcdIntegerData.dbValue = Number( propValue );
        dcdIntegerData.propertyDisplayName = propName;
        dcdIntegerData.isRequired = isRequired;
        dcdIntegerData.propertyRequiredText = requiredText;
    } else if( dcdTypeData === 'Boolean Data Collection' ) {
        dcdBooleanData.dbValue = propValue.toLowerCase() === 'false' ? 'False' : 'True';
        dcdBooleanData.uiValue = dcdBooleanData.dbValue;
        dcdBooleanData.propertyDisplayName = propName;
        dcdBooleanData.isRequired = isRequired;
        dcdBooleanData.propertyRequiredText = requiredText;
        oldValue = dcdBooleanData.dbValue;
        dcdBooleanList = listBoxSvc.createListModelObjectsFromStrings( dcdBooleanListIn.dbValue );
    }else if( dcdTypeData === 'User Defined LOV Data Collection' ) {
        dcdlovList = listBoxSvc
            .createListModelObjectsFromStrings( selectedObj.props.mes0DCDLOV.dbValues );
        dcdLovData.dbValue = propValue;
        dcdLovData.uiValue = propValue;
        dcdLovData.propertyDisplayName = propName;
        dcdLovData.isRequired = isRequired;
        dcdLovData.propertyRequiredText = requiredText;
        oldValue = dcdLovData.dbValue;
    }else if( dcdTypeData === 'Time Stamp Data Collection' ) {
        dcdDateTimeData.propertyDisplayName = propName;
        dcdDateTimeData.isRequired = isRequired;
        dcdDateTimeData.propertyRequiredText = requiredText;
        let timeStampFormat = selectedObj.props.mes0DCDTimeStampFormat.displayValues[ 0 ];
        if( timeStampFormat.indexOf( 'H' ) >= 0 || timeStampFormat.indexOf( 'm' ) >= 0 ||
                     timeStampFormat.indexOf( 's' ) >= 0 ) {
            dcdDateTimeData.dateApi.isTimeEnabled = true;
        } else {
            dcdDateTimeData.dateApi.isTimeEnabled = false;
        }
        let date;
        if( propValue === null || propValue === '' ) {
            date = new Date();
            dcdDateTimeData.dbValue = dateTimeSvc.formatDate( date,
                selectedObj.props.mes0DCDTimeStampFormat.displayValues[ 0 ] );
        } else {
            date = new Date( propValue );
            dcdDateTimeData.dbValue = propValue;
        }
        dcdDateTimeData.dateApi.dateObject = date;
        dcdDateTimeData.dateApi.dateValue = dateTimeSvc.formatDate( date, dateTimeSvc
            .getSessionDateFormat() );
        dcdDateTimeData.dateApi.timeValue = dateTimeSvc.formatTime( date, dateTimeSvc
            .getSessionTimeFormat() );
        oldValue = dcdDateTimeData.dateApi.dateValue;
        oldTimeValue = dcdDateTimeData.dateApi.timeValue;
    }else {
        dcdTypeData = 'String Data Collection';
        dcdStringData.dbValue = propValue;
        dcdStringData.uiValue = propValue;
        dcdStringData.propertyDisplayName = propName;
        dcdStringData.isRequired = isRequired;
        dcdStringData.propertyRequiredText = requiredText;
        if( selectedObj.props.mes0DCDStringMaxLength.displayValues[ 0 ] !== '' ) {
            dcdStringData.maxLength = selectedObj.props.mes0DCDStringMaxLength.displayValues[ 0 ];
        }
    }

    return {
        dcdCommentData,
        selectedObj,
        dcdTypeData,
        dcdDoubleData,
        dcdIntegerData,
        dcdBooleanData,
        dcdLovData,
        dcdDateTimeData,
        dcdBooleanList,
        dcdStringData,
        oldValue,
        oldTimeValue,
        dcdlovList
    };
}

/**
  * Get the execution Value
  *
  * @param {Object} data the data object in scope
  * @return {ObjectArray} the execution values used as "setProperties" SOA call input
  */
export let getCDCExecutionValues = function( data ) {
    let executionValues = [];

    if( data.dcdType.dbValue === 'Real Number Data Collection' ) {
        executionValues.push( data.dcdDouble.dbValue.toString() );
    } else if( data.dcdType.dbValue === 'Integer Data Collection' ) {
        executionValues.push( data.dcdInteger.dbValue.toString() );
    } else if( data.dcdType.dbValue === 'Boolean Data Collection' ) {
        let executionVal = data.dcdBoolean.dbValue === 'True' ? 'true' : 'false';
        executionValues.push( executionVal );
    } else if( data.dcdType.dbValue === 'Time Stamp Data Collection' ) {
        let dateValue = dateTimeSvc.formatNonStandardDate( data.dcdDateTime.dateApi.dateValue,
            data.selectedobject.props.mes0DCDTimeStampFormat.displayValues[ 0 ] );
        executionValues.push( dateValue );
    } else if( data.dcdType.dbValue === 'User Defined LOV Data Collection' ) {
        executionValues.push( data.dcdLov.dbValue.toString() );
    } else {
        executionValues.push( data.dcdString.dbValue );
    }

    return executionValues;
};

/**
  * Get the selected object from the data collection selection event
  *
  * @param {Object} eventData - the data collection selection event data
  *
  * @returns {Object} the selected data collection object
  */
export function getNextSelection( eventData ) {
    return eventData.dataProvider.selectedObjects[0];
}

/**
  * Keep the current comment & value
  *
  * @param {String} oldComment - the current comment dbValue
  * @param {String} dcdType - the current datatype dbValue
  * @param {String} dcdLovVal - the current lov dbValue
  * @param {Integer} dcdIntegerVal - the current integer dbValue
  * @param {Boolean} dcdBooleanVal - the current boolean dbValue
  * @param {String} dcdDateVal - the current date dbValue
  * @param {String} dcdTimeVal - the current time dbValue
  * @param {String} dcdStringVal - the current string dbValue
  * @param {String} dcdDoubleVal - the current double dbValue
  *
  * @return {Object} the current comment & value & time
  */
export function keepValues( oldComment, dcdType, dcdLovVal, dcdIntegerVal, dcdBooleanVal, dcdDateVal, dcdTimeVal, dcdStringVal, dcdDoubleVal ) {
    let oldValue;
    let oldTimeValue;
    if( dcdType === 'Real Number Data Collection' ) {
        oldValue = dcdDoubleVal;
    } else if( dcdType === 'Integer Data Collection' ) {
        oldValue = dcdIntegerVal;
    } else if( dcdType === 'Boolean Data Collection' ) {
        oldValue = dcdBooleanVal;
    } else if( dcdType === 'Time Stamp Data Collection' ) {
        oldValue = dcdDateVal;
        oldTimeValue = dcdTimeVal;
    } else if( dcdType === 'User Defined LOV Data Collection' ) {
        oldValue = dcdLovVal;
    } else {
        oldValue = dcdStringVal;
    }

    return {
        oldComment,
        oldValue,
        oldTimeValue
    };
}

export default exports = {
    updatePanelData,
    getCDCExecutionValues,
    getNextSelection,
    keepValues
};

