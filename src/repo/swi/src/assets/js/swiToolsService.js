/**
 * @module js/swiToolsService
 */


import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';

let exports = {};


export let getToolsForSelectedObject = function (swiAtomicData) {
    let selectedObject = swiAtomicData.selected;
    let toolUids = selectedObject.props.swi1Tools.dbValues;
    let toolObjects = [];
    toolUids.forEach(tool => {
        let toolObject = cdm.getObject(tool);
        toolObjects.push(toolObject);
    });
    return {
        response: toolObjects,
        totalFound: toolObjects.length
    };
};


let createToolsColumns = function (data) {

    const localizeName = data.grids.toolsTableGrid.i18n;
    let awColumnInfos = [];
    let columnNames = ['bl_item_item_id', 'bl_line_name', 'bl_item_object_desc'];
    let columnWidths = [100, 300, 350];
    let displayNames = [
        localizeName.itemIdValueColumn,
        localizeName.nameValueColumn,
        localizeName.descriptionValueColumn
    ];

    for (let itr = 0; itr < columnNames.length; itr++) {
        let pinnedLeft = columnNames[itr] === "bl_item_item_id" ? true : false;
        let displayname = displayNames[itr];
        awColumnInfos.push({
            name: columnNames[itr],
            displayName: displayname,
            width: columnWidths[itr],
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
    getToolsForSelectedObject,
    createToolsColumns
};
