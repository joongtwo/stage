// Copyright (c) 2022 Siemens

/**
 * Defines {@link classifySyncService}
 *
 * @module js/classifySyncService
 */
var exports = {};

/**
 * Get Prop Details

 * @return {Object} the prop Details
 */
export let getAttrsToSync = function( syncObject ) {
    return {
        attributesVisible: syncObject.attributesVisible,
        attr_anno: syncObject.attr_anno
    };
};

/**
 * Get Prop Details

 * @return {Object} the prop Details
 */
export let fetchAttrsData = function( attrData ) {
    return {
        attrsVisible: attrData.attrsVisible,
        attr_anno: attrData.attr_anno,
        filteredAttr_anno: attrData.filteredAttr_anno,
        filteredAttributes: attrData.filteredAttributes,
        isFiltered: attrData.isFiltered,
        selectedClass: attrData.selectedClass
    };
};

export default exports = {
    fetchAttrsData,
    getAttrsToSync
};
