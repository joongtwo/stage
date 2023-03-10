// Copyright (c) 2022 Siemens

/**
 *
 * @param {*} dataProvider data provider
 * @param {*} previousSelection prev selection in dp
 * @param {*} newSelection new selection to set
 * @returns {Object} the resolved selection, and whether there was actual selection change
 */
function updateSelectionOnData( dataProvider, previousSelection, newSelection ) {
    let selectedObject;
    if ( previousSelection && !newSelection ) {
        selectedObject = previousSelection;
        selectedObject.selected = true;
    }else{
        selectedObject = newSelection;
    }
    dataProvider.selectionModel.setSelection( [ selectedObject ]  );
    return {
        selectedObject,
        selectionChanged: !previousSelection || selectedObject.uid !== previousSelection.uid
    };
}

/**
 *
 * @param {*} searchbox search box to clear
 * @returns {Object} the search box prop
 */
function clearSearchBox( searchbox ) {
    if ( searchbox ) {
        searchbox.dbValue = '';
    }
    return searchbox;
}

/**
 *
 * @param {*} dataProvider the data provider to clear
 */
function clearDataProvider( dataProvider ) {
    if ( dataProvider ) {
        dataProvider.getViewModelCollection().clear();
    }
}

export default {
    updateSelectionOnData,
    clearSearchBox,
    clearDataProvider
};
