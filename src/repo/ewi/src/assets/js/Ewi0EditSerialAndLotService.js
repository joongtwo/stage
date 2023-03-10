// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@


/**
 * @module js/Ewi0EditSerialAndLotService
 */


let partIsLotPropertyName;
let partIsSerializedPropertyName;
let toolIsLotPropertyName;
let toolIsSerializedPropertyName;

/**
 * Get the isSerial and isLot Property name from preference
 *
 * @param {ObjectArray} preferences - list of preferences
 */
export function getIsSerialLotPropertyName( preferences ) {
    partIsLotPropertyName = preferences.EWI_PartIsLotProperty[ 0 ];
    partIsSerializedPropertyName = preferences.EWI_PartIsSerializedProperty[ 0 ];
    toolIsLotPropertyName = preferences.EWI_ToolIsLotProperty[ 0 ];
    toolIsSerializedPropertyName = preferences.EWI_ToolIsSerializedProperty[ 0 ];
}

/**
 * Get the selected part/ tool data to display in the 'Edit serial/ lot' panel
 *
 * @param {Object} selectedObj - the selected part/ tool object
 *
 * @return {Object} all the serial & lot data
 */
export function updatePanelData( selectedObj ) {
    let isLot;
    let isSerial;

    if( selectedObj.modelType.typeHierarchyArray.indexOf( 'Mfg0BvrPart' ) > -1 ) {
        isLot = selectedObj.props[ partIsLotPropertyName ].value;
        isSerial = selectedObj.props[ partIsSerializedPropertyName ].value;
    } else if( selectedObj.modelType.typeHierarchyArray.indexOf( 'Mfg0BvrEquipment' ) > -1 ) {
        isLot = selectedObj.props[ toolIsLotPropertyName ].value;
        isSerial = selectedObj.props[ toolIsSerializedPropertyName ].value;
    }

    isLot = isLot === 'True' || isLot === 'true' || isLot === 'TRUE' || isLot === true;
    isSerial = isSerial === 'True' || isSerial === 'true' || isSerial === 'TRUE' || isSerial === true;

    let lotNumber = selectedObj.props.ewi0LotNumber.dbValue;
    lotNumber = lotNumber ? lotNumber : '';

    let serialNumber = selectedObj.props.ewi0SerialNumber.dbValue;
    serialNumber = serialNumber ? serialNumber : '';

    return {
        isSerial,
        isLot,
        serialNumber,
        lotNumber,
        selectedObj,
        orgSerialNumber: serialNumber,
        orgLotNumber: lotNumber
    };
}


/**
 * Keep the current lot & serial values
 *
 * @param {Integer} serialNumber - the current serial number dbValue
 * @param {Integer} lotNumber - the current lot number dbValue
 *
 * @return {Object} the current serial & lot values
 */
export function keepValues( serialNumber, lotNumber ) {
    return {
        orgSerialNumber: serialNumber,
        orgLotNumber: lotNumber
    };
}

/**
 * Get the selected object from the parts/ tools selection event
 *
 * @param {Object} eventData - the parts/ tools selection event data
 *
 * @returns {Object} the selected part/ tool object
 */
export function getNextSelection( eventData ) {
    return eventData.dataProvider.selectedObjects[0];
}

export default {
    getIsSerialLotPropertyName,
    updatePanelData,
    keepValues,
    getNextSelection
};
