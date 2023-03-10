// Copyright (c) 2022 Siemens

/**
 * This is a utility to aid in importing BMEcat data.
 *
 * @module js/importBMEcatService
 */
var exports = {};

/*
* Handles import of classification data
* @param { dataFiles } list of full length file paths of importable BMEcat CLS files
*/
export let updateCLSImportListbox = function( dataFiles ) {
    let fileList = [];
    fileList.push( {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        sel: false
    } );
    for( var k = 0; k < dataFiles.length; k++ ) {
        let file = {
            propDisplayValue: '',
            propInternalValue: '',
            propDisplayDescription: '',
            sel: false
        };
        let delimiterIndex = dataFiles[ k ].lastIndexOf( '\\' ) + 1;
        if( delimiterIndex === 0 ) {
            //server is using Linux file delimiters
            delimiterIndex = dataFiles[ k ].lastIndexOf( '/' ) + 1;
        }
        let shortName = '';
        if ( delimiterIndex === 0 ) {
            shortName = dataFiles[ k ];
        } else {
            shortName = dataFiles[k].substring( delimiterIndex );
        }
        file.propDisplayValue = shortName;
        file.propInternalValue = dataFiles[ k ];

        fileList.push( file );
    }
    return fileList;
};


/*
* Handles file selection from clsdata import dropdown list
* @param {Object} data - view model data
*/
export let selectClsDataImportFile = function( data ) {
    var selectedClsImportFile = {};

    if( data.potentialImportsListBox.dbValue && data.potentialImportsListBox.displayValues[0] ) {
        selectedClsImportFile = {
            relativePath: data.potentialImportsListBox.dbValue,
            fileName: data.potentialImportsListBox.displayValues[0]
        };
    }

    return selectedClsImportFile;
};

/*
* Clears objects that were loaded into classificationDataFiles. This is to ensure no files exist on dropdown after selecting incorrect files
*/
export let clearCLSImportListbox = function() {
    return [];
};

export default exports = {
    clearCLSImportListbox,
    selectClsDataImportFile,
    updateCLSImportListbox
};
