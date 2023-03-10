// Copyright (c) 2022 Siemens

/**
 * @module js/swiPartsService
 */
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
let exports = {};

export let setPartsData = function (swiAtomicData) {
    let selectedObj = swiAtomicData.selected;
    let swiParts = selectedObj.props.swi1Parts.dbValues;
    let vmos = [];
    swiParts.forEach(element => {
        let obj = cdm.getObject(element);
        vmos.push(obj);
    });
    return {
        response: vmos,
        totalFound: vmos.length
    };
};

export let setPartsColumn = function (data) {

    const localizeName = data.grids.partsTableGrid.i18n;
    let awColumnInfos = [];
    let columnNames = ['bl_item_item_id', 'bl_line_name', 'bl_item_object_desc', 'bl_occurrence_name', 'bl_occ_type', 'bl_quantity'];
    let displayNames = [
        localizeName.itemIdValueColumn,
        localizeName.nameValueColumn,
        localizeName.descriptionValueColumn,
        localizeName.occNameValueColumn,
        localizeName.occTypeValueColumn,
        localizeName.quantityValueColumn
    ];

    for (let itr = 0; itr < columnNames.length; itr++) {
        let pinnedLeft = columnNames[itr] === "bl_item_item_id" ? true : false;
        let displayname = displayNames[itr];
        awColumnInfos.push({
            name: columnNames[itr],
            displayName: displayname,
            width: 120,
            enableColumnMenu: false,
            enableColumnMoving: false,
            pinnedLeft: pinnedLeft
        });
    }

    return {
        columnConfig: {
            columns: awColumnInfos
        }
    };

};

export default exports = {
    setPartsData,
    setPartsColumn
};
