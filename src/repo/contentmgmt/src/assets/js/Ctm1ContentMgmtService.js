// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Ctm1ContentMgmtService
 */
import AwHttpService from 'js/awHttpService';
import modelPropertySvc from 'js/modelPropertyService';
import cdm from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';
import appCtxService from 'js/appCtxService';
import fileMgmtSvc from 'soa/fileManagementService';
import fmsUtils from 'js/fmsUtils';
import browserUtils from 'js/browserUtils';
import localeSvc from 'js/localeService';
import AwStateService from 'js/awStateService';
import parsingUtils from 'js/parsingUtils';
import _ from 'lodash';

/**
  * The FMS proxy servlet context. This must be the same as the FmsProxyServlet mapping in the web.xml
  */
var WEB_XML_FMS_PROXY_CONTEXT = 'fms';

/**
  * Relative path to the FMS proxy download service.
  */
var CLIENT_FMS_DOWNLOAD_PATH = WEB_XML_FMS_PROXY_CONTEXT + '/fmsdownload/';

/**
  * event constants
  */
var FND0_CONTMGMT_BREX_VALIDATE_FAILURE = 'Fnd0Content_BREXValidateFailure'; //NON-NLS-1
var FND0_CONTMGMT_BREX_VALIDATE_SUCCESS = 'Fnd0Content_BREXValidateSuccess'; //NON-NLS-1

var exports = {};

// Model Property service

var _localizedText = {};

/**
  * Gets the object selected in the BOM tree structure.
  *
  * @param {Object} ctx the context
  * @returns {Object} the selected object
  */
export let getBomSelectedObj = function( ctx ) {
    if( ctx.occmgmtContext && ctx.occmgmtContext.selectedModelObjects.length ) {
        return ctx.occmgmtContext.selectedModelObjects[ 0 ];
    } else if ( ctx.selected.props.awb0UnderlyingObject ) {
        return ctx.selected;
    }
    return null;
};

/**
  * Gets the underlying object of the object selected in the BOM tree structure.
  *
  * @param {Object} bomObject the selected object if known
  * @returns {Object} the underlying object of the BOM object
  */
export let getBomUnderlyingObj = function( bomObject ) {
    if( bomObject ) {
        return cdm.getObject( bomObject.props.awb0UnderlyingObject.dbValues[ 0 ] );
    }
    return null;
};

/**
  * Gets the parent of the object selected in the BOM tree structure.
  *
  * @param {Object} bomObject the selected object if known
  * @returns {Object} the parent of the BOM object
  */
export let getBomParentObj = function( bomObject ) {
    if( bomObject ) {
        return cdm.getObject( bomObject.props.awb0Parent.dbValues[ 0 ] );
    }
    return null;
};

/**
  * This method is used to get the list from soa response.
  * @param {Object} response the response of the soa
  * @param {Object} data the data object
  * @param {String} insertEmptyItem "true" if an empty string should be inserted at head of array
  * @returns {Array} value the LOV value
  */
export let getLovFromQuery = function( response, data, insertEmptyItem ) {
    var value;

    if( response.searchResults ) {
        value = response.searchResults.map( function( obj ) {
            if( obj.modelObject.props.languageName ) {
                return {
                    propDisplayValue: obj.modelObject.props.languageName.uiValues[ 0 ],
                    propInternalValue: obj.modelObject.uid
                };
            }

            return {
                propDisplayValue: obj.modelObject.props.object_name ? obj.modelObject.props.object_name.uiValues[ 0 ] : obj.modelObject.props.object_string.uiValues[ 0 ],
                propInternalValue: obj.modelObject.uid,
                propInternalType: obj.modelObject.type
            };
        } );
    } else if( response.searchResultsJSON ) {
        var modelObjectMap = null;
        if( response.ServiceData && response.ServiceData.modelObjects ) {
            modelObjectMap = response.ServiceData.modelObjects;
        }
        value = getLovFromJsonQuery( response.searchResultsJSON, modelObjectMap );
    } else if( response.lovValues ) {
        value = response.lovValues.map( function( obj ) {
            return {
                propDisplayValue: obj.propDisplayValues.lov_values[ 0 ],
                propInternalValue: obj.propInternalValues.lov_values[ 0 ]
            };
        } );
    } else {
        value = [];
    }

    if( insertEmptyItem === 'true' ) {
        var emptyPropArray = [ {
            propDisplayValue: '',
            propInternalType: '',
            propInternalValue: ''
        } ];
        value = emptyPropArray.concat( value );
    }
    return value;
};

/**
  * Parses the response from a JSON query and returns the results as an array of model objects.
  *
  * @param {String} resultsJSON the query response as a JSON string
  * @param {Map} modelObjectMap the map of UID to modelObject
  * @returns {Array} the array of model objects
  */
var getLovFromJsonQuery = function( resultsJSON, modelObjectMap ) {
    var lov = [];
    var lovObj = null;
    var jsonObjs = JSON.parse( resultsJSON );

    if( jsonObjs && jsonObjs.objects ) {
        _.forEach( jsonObjs.objects, function( jsonObj ) {
            var displayValue = '';
            var modelObj = modelObjectMap ? modelObjectMap[ jsonObj.uid ] : null;
            if( modelObj ) {
                if( modelObj.props.languageName ) {
                    displayValue = modelObj.props.languageName.uiValues[ 0 ];
                } else {
                    displayValue = modelObj.props.object_name ? modelObj.props.object_name.uiValues[ 0 ] : modelObj.props.object_string.uiValues[ 0 ];
                }
            }
            // if for some reason the model object map isn't present, there's no way to get the display value synchronously (?)
            // will have to address later if it crops up

            lovObj = {
                propDisplayValue: displayValue,
                propInternalValue: jsonObj.uid,
                propInternalType: jsonObj.type
            };
            lov.push( lovObj );
        } );
    }

    return lov;
};

/**
  * This method is used to get the list from a preference.
  * @param {Array} pref the preference
  * @returns {Array} value the LOV value
  */
export let getLovFromPref = function( pref ) {
    var value;

    if( pref ) {
        value = pref.map( function( obj ) {
            return {
                propDisplayValue: obj.split( ',' )[ 0 ],
                propInternalValue: obj
            };
        } );
    }

    return value;
};


/**
  * This method is used to get the list from soa response and gets checkbox data information.
  * @param {Object} response the response of the soa
  * @param {Object} data the data object
  * @param {String} insertEmptyItem "true" if an empty string should be inserted at head of array
  * @returns {Array} Checkbox data information
  */
export let getLovFromQueryAndGetCheckBoxData = function( response, data, insertEmptyItem ) {
    var lovResult = exports.getLovFromQuery( response, data, insertEmptyItem );
    return exports.getCheckBoxData( lovResult, data, null, false );
};

/**
  * Parses the response from the call to fileMgmtSvc.getFileReadTickets() and downloads the file.
  *
  * @param {Object} readFileTicketsResponse the response from fileMgmtSvc.getFileReadTickets()
  */
var handleGetReadTicketsResponse = function( readFileTicketsResponse ) {
    var originalFileName = '';
    if( readFileTicketsResponse && readFileTicketsResponse.tickets && readFileTicketsResponse.tickets.length > 1 ) {
        var imanFileArray = readFileTicketsResponse.tickets[ 0 ];
        if( imanFileArray && imanFileArray.length > 0 ) {
            var imanFileObj = cdm.getObject( imanFileArray[ 0 ].uid );
            if( imanFileObj.props ) {
                originalFileName = imanFileObj.props.original_file_name.uiValues[ 0 ];
                originalFileName.replace( ' ', '_' );
            }
        }
        var ticketsArray = readFileTicketsResponse.tickets[ 1 ]; // 1st element is array of iman file while 2nd element is array of tickets
        if( ticketsArray && ticketsArray.length > 0 ) {
            downloadFileInternal( buildUrlFromFileTicket( ticketsArray[ 0 ], originalFileName ) );
        }
    }
};

export let copyGraphicReference = function (data) {
    let imanFile = data.dataset.props.ref_list.dbValues[0];
    let imanFileModelObject = cdm.getObject(imanFile);
    let fileName = imanFileModelObject.props.original_file_name.dbValues[0];

    // text area method
    let textArea = document.createElement("textarea");
    textArea.value = '<image href="' + fileName + '"/>';
    // Place in top-left corner of screen regardless of scroll position.
    textArea.style.position = 'fixed';
    textArea.style.top = 0;
    textArea.style.left = 0;

    // Ensure it has a small width and height. Setting to 1px / 1em doesn't work as this gives a negative w/h on
    // some browsers.
    textArea.style.width = '2em';
    textArea.style.height = '2em';

    // We don't need padding, reducing the size if it does flash render.
    textArea.style.padding = 0;

    // Clean up any borders.
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';

    // Avoid flash of white box if rendered for any reason.
    textArea.style.background = 'transparent';

    let refEle = document.activeElement;
    refEle.appendChild(textArea);
    textArea.select();

    var verdict = document.execCommand('copy', false, null); //execute copy command
    refEle.removeChild(textArea);
};

export let downloadDataset = function( data ) {
    var imanFile = null;

    // get Named reference File
    if( data.dataset.props.ref_list && data.dataset.props.ref_list.dbValues.length > 0 ) {
        imanFile = data.dataset.props.ref_list.dbValues[ 0 ];
    } else {
        dmSvc.getProperties( [ data.dataset.uid ], [ 'ref_list' ] ).then( function() {
            // get Named reference File
            if( data.dataset.props.ref_list && data.dataset.props.ref_list.dbValues.length > 0 ) {
                imanFile = data.dataset.props.ref_list.dbValues[ 0 ];
            }
        } );
    }

    // Get iman file object from uid
    var imanFileModelObject = cdm.getObject( imanFile );

    // downloadTicket
    var files = [ imanFileModelObject ];
    var promise = fileMgmtSvc.getFileReadTickets( files );
    promise.then( handleGetReadTicketsResponse );
};

/**
 * Soa input needs empty string if search string is null
 * This function checks if search string in empty in lov then it returns empty string otherwise return typed search string
 * @param {*} searchStr
 * @returns
 */
 export let getSearchString = function( searchStr ) {
    var filterString = '*';
    if ( searchStr !== null && searchStr !== undefined ) {
        filterString = '*' + searchStr + '*';
    }
    return filterString;
};

export let getTranslationLanguageList = function( data ) {
    var checkBoxModels = [];

    var selObj = appCtxService.ctx.selected;
    if( selObj.props.fnd0TrnslOfficeTagref ) {
        var transOffice = cdm.getObject( selObj.props.fnd0TrnslOfficeTagref.dbValues[ 0 ] );

        for( var i = 0; i < transOffice.props.languagesTbl.dbValues.length; i++ ) {
            var langTbl = cdm.getObject( transOffice.props.languagesTbl.dbValues[ i ] );
            var langObj = cdm.getObject( langTbl.props.fnd0LanguageTagref.dbValues[ 0 ] );

            var lang = {
                displayName: langObj.props.object_string.uiValues[ 0 ],
                type: 'BOOLEAN',
                isRequired: 'false',
                isEditable: 'true',
                dbValue: '',
                dispValue: '',
                labelPosition: 'PROPERTY_LABEL_AT_RIGHT'
            };

            var langVMP = modelPropertySvc.createViewModelProperty( lang );
            langVMP.obj = langObj;
            checkBoxModels.push( langVMP );
        }
    }

    data.dataProviders.languageListProvider.update( checkBoxModels, checkBoxModels.length );

    return { languageList: checkBoxModels };
};

/**
  * This method is used to get the Language list from soa response.
  * @param {Object} response the response of the soa
  * @returns {Array} value the LOV value
  */
export let getLanguageResponseList = function( response ) {
    var value = exports.getLovFromQuery( response );

    value.unshift( {
        propDisplayValue: '(Master Language)',
        propInternalValue: '(Master Language)'
    } );

    return value;
};

/**
  * This method is used to get the default language.
  * @returns {Object} value the LOV value
  */
export let getDefaultLanguage = function() {
    if( appCtxService.getCtx( 'preferences' ).ctm0DefaultLanguage.length > 0 ) {
        return appCtxService.getCtx( 'preferences' ).ctm0DefaultLanguage[ 0 ];
    }

    return '*';
};

/**
  * This method is used to get the Language value.
  * @param {Object} response the response of the soa
  * @param {Object} data the view data
  * @returns {Object} value the LOV value
  */
export let setLanguage = function( response, data ) {
    if( response && response.searchResults && response.searchResults.length > 0 ) {
        data.revision__ctm0MasterLanguageTagref.uiValue = response.searchResults[ 0 ].modelObject.props.languageName.uiValues[ 0 ];
        data.revision__ctm0MasterLanguageTagref.dbValue = response.searchResults[ 0 ].modelObject.uid;

        return exports.getLovFromQuery( response );
    } else if( data.language && data.languageList && appCtxService.ctx.preferences.ctm0DefaultLanguage.length > 0 ) {
        for( var i = 0; i < data.languageList.length; ++i ) {
            if( data.languageList[ i ].propDisplayValue === appCtxService.ctx.preferences.ctm0DefaultLanguage[ 0 ] ) {
                data.language.uiValue = data.languageList[ i ].propDisplayValue;
                data.language.dbValue = data.languageList[ i ].propInternalValue;
                break;
            }
        }
    }
};

var buildUrlFromFileTicket = function( fileTicket, overrideFileName ) {
    var fileName = fmsUtils.getFilenameFromTicket( fileTicket );
    var downloadUri = CLIENT_FMS_DOWNLOAD_PATH + fileName + '?ticket=' +
         fileTicket.substring( fileTicket.indexOf( '=' ) + 1 );
    var baseUrl = browserUtils.getBaseURL();
    var urlFullPath = baseUrl + downloadUri;

    if( overrideFileName !== undefined && overrideFileName.length > 0 ) {
        fileName = overrideFileName;
    }

    return { fileName, urlFullPath };
};

var downloadFileInternal = function( info ) {
    //IE doesn't support download attribute; need alternative method to download correct filename
    var browserIsIE = navigator.userAgent.indexOf( 'MSIE' ) > -1 || navigator.appVersion.indexOf( 'Trident/' ) > -1;

    if( !browserIsIE ) {
        // Create an invisible A element
        const a = document.createElement( 'a' );
        a.style.display = 'none';
        document.body.appendChild( a );

        // Set the HREF to a Blob representation of the data to be downloaded
        a.href = info.urlFullPath;

        // Use download attribute
        a.setAttribute( 'download', info.fileName );

        // Trigger the download by simulating click
        a.click();

        // Cleanup
        window.URL.revokeObjectURL( a.href );
        document.body.removeChild( a );
    } else {
        //IE section
        //Get blob from XML Http Request, then call the
        //msSaveBlob function (supported in IE).
        var xhr = new XMLHttpRequest();
        xhr.open( 'GET', info.urlFullPath, true );
        xhr.responseType = 'blob';
        xhr.onload = function() {
            navigator.msSaveBlob( this.response, info.fileName );
        };
        xhr.send();
    }
};

export let downloadFile = function( data ) {
    var fileTicket = data.composedData[ 0 ].composedTransientFileReadTicket;
    //window.open( buildUrlFromFileTicket( fileTicket ), '_self', 'enabled' );
    downloadFileInternal( buildUrlFromFileTicket( fileTicket ) );
};

export let getCheckBoxData = function( lov, data, paramName, initialValue = 'true' ) {
    var checkBoxModels = [];

    for( var i = 0; i < lov.length; ++i ) {
        var checkBoxModel = {
            displayName: lov[ i ].propDisplayValue,
            type: 'BOOLEAN',
            isRequired: 'false',
            isEditable: 'true',
            dbValue: initialValue,
            uiValue: initialValue,
            dispValue: '',
            labelPosition: 'PROPERTY_LABEL_AT_RIGHT'
        };

        var prop = modelPropertySvc.createViewModelProperty( checkBoxModel );
        prop.internalValue = lov[ i ].propInternalValue;

        checkBoxModels.push( prop );
    }

    // Update data.paramName to contain the checkbox list
    if( data && paramName ) {
        data[ paramName ] = checkBoxModels;
    }

    return checkBoxModels;
};

export let getDitaValueFilters = function( data ) {
    var ticket = data.eventData.composedData[ 0 ][ 0 ].composedTransientFileReadTicket;
    var info = buildUrlFromFileTicket( ticket );

    var promise = AwHttpService.instance.get( info.urlFullPath );
    promise.then( function( response ) {
        if( response.data && response.data.length > 0 ) {
            var list = [];
            var sArray = response.data.split( '\n' );
            for( var i = 0; i < sArray.length; ++i ) {
                var sString = sArray[ i ].trim();

                if( sString.length > 0 ) {
                    var row = {
                        propDisplayValue: sString,
                        propInternalValue: sString.split( ',' )[ 0 ]
                    };

                    list.push( row );
                }
            }

            data.ditaValueFiltersList = exports.getCheckBoxData( list, null, null, 'true' );
            data.dataProviders.ditaValueFilters.update( data.ditaValueFiltersList, data.ditaValueFiltersList / length );
        }
    } );
};

var getCheckedArray = function( list, checked = 'TRUE' ) {
    var array = [];

    // Find all checked or unchecked rows in list
    for( var i = 0; i < list.length; ++i ) {
        var dbVal = 'FALSE';
        if( list[ i ].dbValue === true ) {
            dbVal = 'TRUE';
        }

        var dispVal = list[ i ].displayValues[ 0 ].toUpperCase();
        if( dbVal === checked || dispVal === checked ) {
            array.push( list[ i ] );
        }
    }

    return array;
};

export let getChecked = function( list, checked = 'TRUE' ) {
    // Find all checked or unchecked rows in list
    var array = getCheckedArray( list, checked );

    // append array items to one string
    var rString = '';
    for( var i = 0; i < array.length; ++i ) {
        var value = array[ i ].propertyName;

        // If the value already has comma; then exclude it with the preceding text
        var n = value.indexOf( ',' );
        if( n > 0 ) {
            value = value.split( ',' )[ 0 ];
        }

        rString += value + ',';
    }

    // remove extra comma character
    if( rString.length > 0 ) {
        rString = rString.substring( 0, rString.length - 1 );
    }

    return rString;
};

export let getObject = function( uid ) {
    return cdm.getObject( uid );
};

export let rejectSuggestions = function( suggestion ) {
    var valid = true;
    var message = '';

    if( suggestion ) {
        valid = false;
        if( _localizedText.invalidValue ) {
            message = _localizedText.invalidValue.replace( '{0}', suggestion );
        }
    }

    return {
        valid: valid,
        message: message
    };
};

/**
  * This method redirects the user from the Notification message directly to the Topic it is about.
  *
  * @param {Object} notificationObject the Notification clicked on
  */
export let openLineItem = function( notificationObject ) {
    var eventTypeId = null;
    if( notificationObject.eventObj ) {
        eventTypeId = notificationObject.eventObj.props.eventtype_id.dbValues[ 0 ];
    }

    if( eventTypeId === FND0_CONTMGMT_BREX_VALIDATE_FAILURE || eventTypeId === FND0_CONTMGMT_BREX_VALIDATE_SUCCESS ) {
        // instead of opening fnd0TargetObject, we are going to look for a dataset in fnd0RelatedObjects
        var dataset = cdm.getObject( notificationObject.object.props.fnd0RelatedObjects.dbValues[ 0 ] );
        // and download the log file in the dataset
        var imanFileUid = dataset.props.ref_list.dbValues[ 0 ]; // process only first file uid
        if( !imanFileUid ) {
            // no log file
            return;
        }
        var imanFileModelObject = cdm.getObject( imanFileUid );
        var files = [ imanFileModelObject ];
        var promise = fileMgmtSvc.getFileReadTickets( files );
        promise.then( handleGetReadTicketsResponse );
    } else {
        // publish case - there is no eventObj
        var eventObjUid = notificationObject.object.props.fnd0TargetObject.dbValues[ 0 ];
        var showObject = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
        var toParams = {
            uid: eventObjUid,
            page: 'Content'
        };
        var options = {
            inherit: false
        };

        AwStateService.instance.go( showObject, toParams, options );
    }
};

/**
  * This function determines the user's browser,
  * then downloads the XMetaL launch file using the appropriate method per browser.
  * @param {String} uid the uid of the Topic to be opened
  * @param {String} itemId the item ID of the Topic to be opened
  */
export let openInXMetaL = function( uid, itemId ) {
    var launchFileContents = generateLaunchFileContents( uid, itemId, 'xmetal' );
    var hrefValue = 'data:application/openxmetal;charset=utf-8,' + encodeURIComponent( launchFileContents );
    var filename = 'openinxmetal.awctm';

    //IE doesn't support download attribute; need alternative method to download correct filename
    var browserIsIE = navigator.userAgent.indexOf( 'MSIE' ) > -1 || navigator.appVersion.indexOf( 'Trident/' ) > -1;

    if( browserIsIE ) {
        var file = new Blob( [ launchFileContents ], { type: 'application/openxmetal' } );
        navigator.msSaveOrOpenBlob( file, filename );
    } else {
        var a = document.createElement( 'a' );
        a.setAttribute( 'href', hrefValue );
        a.setAttribute( 'download', filename );

        if( document.createEvent ) {
            var event = document.createEvent( 'MouseEvents' );
            event.initEvent( 'click', true, true );
            a.dispatchEvent( event );
        } else {
            a.click();
        }
    }
};

/**
  * This function determines the user's browser,
  * then downloads the Oxygen launch file using the appropriate method per browser.
  * @param {String} uid the uid of the Topic to be opened
  * @param {String} itemId the item ID of the Topic to be opened
  */
export let openInOxygen = function( uid, itemId ) {
    var launchFileContents = generateLaunchFileContents( uid, itemId, 'oxygen' );
    var hrefValue = 'data:application/openoxygen;charset=utf-8,' + encodeURIComponent( launchFileContents );
    var filename = 'openinoxygen.awoctm';

    //IE doesn't support download attribute; need alternative method to download correct filename
    var browserIsIE = navigator.userAgent.indexOf( 'MSIE' ) > -1 || navigator.appVersion.indexOf( 'Trident/' ) > -1;

    if( browserIsIE ) {
        var file = new Blob( [ launchFileContents ], { type: 'application/openoxygen' } );
        navigator.msSaveOrOpenBlob( file, filename );
    } else {
        var a = document.createElement( 'a' );
        a.setAttribute( 'href', hrefValue );
        a.setAttribute( 'download', filename );

        if( document.createEvent ) {
            var event = document.createEvent( 'MouseEvents' );
            event.initEvent( 'click', true, true );
            a.dispatchEvent( event );
        } else {
            a.click();
        }
    }
};

/**
  * Get the name of topic type associated with a topic.
  * @param {String} uid the uid of the Topic selected
  * @returns {String} name of the topic type.
  */
export let getTopicTypeName = function( uid ) {
    let selected =  cdm.getObject( uid );
    return selected.props.ctm0TopicTypeTagref.uiValues[0];
};

/**
  * get first result objet from soa response.
  * @param {object} response soa response
  * @returns {object} first model object in result.
  */
export let getFirstResult = function( response ) {
    var searchResults = [];
    var modelObj = null;

    if( response.searchResults && response.searchResults.length > 0 ) {
        searchResults = response.searchResults;
        modelObj = searchResults[0].modelObject;
    }else if( response.searchResultsJSON && response.searchResultsJSON.length > 0 ) {
        searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
        if( searchResults.length && searchResults[0].modelObject ) {
            modelObj = searchResults[0].modelObject;
        } else if( searchResults.objects && searchResults.objects.length ) {
            modelObj = searchResults.objects[0];
        }
    }

    return modelObj;
};

/**
  * Get SNS type.
  * @param {object} lov sns type lov list
  * @param {string} interName sns type internal name.
  * @returns {object} the SNS type
  */
var getSNSType = function( lov, interName ) {
    let value;
    for ( let i = 0; i < lov.length; i++ ) {
        if ( lov[i].propInternalValue === interName ) {
            value = lov[i];
            break;
        }
    }

    return value;
};

/**
  * Set child nSNS node type
  * @param {object} data view model data
  */
export let setChildSNSType = function( data ) {
    var selectedObject = exports.getBomSelectedObj( appCtxService.ctx );
    let parentObject = getBomUnderlyingObj( selectedObject );

    if ( data.ctm1snsTypeLOV && parentObject ) {
        let childTypeLOV;
        if ( parentObject.type === 'Civ0SNSRootNodeRevision' ) {
            childTypeLOV = getSNSType( data.ctm1snsTypeLOV, 'ctm0System' );
        } else if ( parentObject.props.ctm0Type.dbValues[0] === 'ctm0System' ) {
            childTypeLOV = getSNSType( data.ctm1snsTypeLOV, 'ctm0SubSystem' );
        } else if ( parentObject.props.ctm0Type.dbValues[0] === 'ctm0SubSystem' ) {
            childTypeLOV = getSNSType( data.ctm1snsTypeLOV, 'ctm0SubSubSystem' );
            if ( !childTypeLOV ) {
                childTypeLOV = getSNSType( data.ctm1snsTypeLOV, 'ctm0Assembly' );
            }
        } else if ( parentObject.props.ctm0Type.dbValues[0] === 'ctm0SubSubSystem' ) {
            childTypeLOV = getSNSType( data.ctm1snsTypeLOV, 'ctm0Assembly' );
        } else if ( parentObject.props.ctm0Type.dbValues[0] === 'ctm0Assembly' ) {
            childTypeLOV = getSNSType( data.ctm1snsTypeLOV, 'ctm0Disassembly' );
        }

        if ( childTypeLOV ) {
            data.revision__ctm0Type.dbValue = childTypeLOV.propInternalValue;
            data.revision__ctm0Type.uiValue = childTypeLOV.propDisplayValue;
        }
    }
};

/**
  * This function generates the contents of the XMetaL launch file.
  * @param {String} uid the uid of the Topic to be opened
  * @param {String} itemId the item ID of the Topic to be opened
  * @param {String} tag XML tag for targer launch application
  * @returns {String} content the complete text of the launch file
  */
var generateLaunchFileContents = function( uid, itemId, tag ) {
    var content = '<?xml version="1.0" encoding="ISO-8859-1"?>';
    content += '<' + tag + '>\n';
    content += '<uid>' + uid + '</uid>\n';
    content += '<itemId>' + itemId + '</itemId>\n';
    content += '</' + tag + '>';
    return content;
};

var loadConfiguration = function() {
    localeSvc.getTextPromise( 'ContentMgmtMessages', true ).then(
        function( localTextBundle ) {
            _localizedText = localTextBundle;
        } );
};

loadConfiguration();

/**
  * Ctm1ContentMgmtService factory
  */

export default exports = {
    getBomSelectedObj,
    getBomUnderlyingObj,
    getBomParentObj,
    getLovFromQuery,
    getLovFromPref,
    copyGraphicReference,
    downloadDataset,
    getTranslationLanguageList,
    getLanguageResponseList,
    getDefaultLanguage,
    setLanguage,
    downloadFile,
    getCheckBoxData,
    getDitaValueFilters,
    getChecked,
    getObject,
    rejectSuggestions,
    openLineItem,
    openInXMetaL,
    openInOxygen,
    getTopicTypeName,
    getFirstResult,
    setChildSNSType,
    getSearchString,
    getLovFromQueryAndGetCheckBoxData
};
