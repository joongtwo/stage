// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 *
 * @module js/wiCkeditor5Service
 */
import AwPromiseService from 'js/awPromiseService';
import WIAutocomplete from 'js/wiAutocomplete/wiAutocomplete';
import WIPartsToolsPlaceholder from 'js/wiPartsToolsPlaceholder/wiPartsToolsPlaceholder';
import WIStandardTextPlaceholder from 'js/wiStandardTextPlaceholder/wiStandardTextPlaceholder';
import WIVisualsPlaceholder from 'js/wiVisualsPlaceholder/wiVisualsPlaceholder';
import WIAddSymbol from 'js/wiAddSymbol/wiAddSymbol';
import { ckeditor5ServiceInstance } from 'js/wiEditor.service';


const DIVISION_ELEMENT = 'div';


/**
 * Class to hold ckeditor5 instance
 */
class WICkeditor5 {
    constructor( editor ) {
        this._instance = editor;
    }
    getData() {
        return this._instance.getData();
    }

    setData( content ) {
        content = content ? content : '';
        this._instance.setData( content );
    }

    /**
     * Registers a callback function to be executed when an event is fired
     * @param {String} eventName -
     * @param {Object} callbackFunction -
     */
    on( eventName, callbackFunction ) {
        switch ( eventName ) {
            case 'change':
                this._instance.model.document.on( 'change:data', callbackFunction );
                break;
            case 'focus':
                this._instance.ui.focusTracker.on( 'change:isFocused', callbackFunction );
                break;
        }
    }

    destroy() {
        this._instance.destroy();
    }
}


/**
 * Function to load extra plugins dynamically
 * @param {Array} extraPlugins - String array
 */
async function loadExtraPluginsForCkeditor5( extraPlugins ) {
    return await Promise.all(
        extraPlugins
    );
}

/**
 *
 * @param {String} elementId element id to initialize editor instance
 * @returns {Object} editor instance
 */
function createWiEditorInstance( elementId ) {
    let deferred = AwPromiseService.instance.defer();
    let config = getWiEditorConfiguration();
    config.extraPlugins = config.extraPlugins ? config.extraPlugins : [];
    loadExtraPluginsForCkeditor5( config.extraPlugins ).then( loadedPlugins => { // Dynamic loading of extra plugins
        config.extraPlugins = loadedPlugins;
        // Creates an instance of the classic Ckeditor5
        ckeditor5ServiceInstance.DecoupledEditor.create( document.querySelector( '#' + elementId ), config ).then( editor => {
            editor = new WICkeditor5( editor );
            deferred.resolve( editor );
        }, elementId );
    } );
    return deferred.promise;
}

/**
 *
 * @returns {Object} ckeditor configuration for work instructions
 */
function getWiEditorConfiguration() {
    let config = {};
    config.extraPlugins = [ WIAutocomplete, WIPartsToolsPlaceholder, WIStandardTextPlaceholder, WIVisualsPlaceholder, WIAddSymbol ];
    config.language = 'en';
    config.toolbar = {
        items:[
            'fontfamily', 'fontsize', 'heading', '|',
            'bold', 'italic', 'underline', '|', 'fontColor', 'fontBackgroundColor', '|', 'copyFormatting', '|',
            'numberedList', 'bulletedList', '|', 'outdent', 'indent', '|', 'alignment:left', 'alignment:center', 'alignment:right', 'alignment:justify', '|',
            'insertTable', 'specialCharacters', 'wiAddSymbol'
        ],
        shouldNotGroupWhenFull: true
    };
    return config;
}
/**
 *
 * @param {Object} editorInstance editor instance
 * @param {String} marker marker for autocomplete
 * @param {String} elementName element name to add
 * @param {Object} attributes element attribute
 */
function insertContent( editorInstance, marker, elementName, attributes  ) {
    let selection = editorInstance._instance.model.document.selection;
    let focus = selection.focus;
    editorInstance._instance.model.change( writer => {
        const element = writer.createElement( elementName, attributes );
        editorInstance._instance.model.insertContent( element );
    } );
    let data = editorInstance.getData();
    data = data.replaceAll( marker + '<', '<' );

    editorInstance.setData( data );

    let view = editorInstance._instance.editing.view;
    setTimeout( () => {
        view.focus();
        editorInstance._instance.model.change( writer => {
            writer.setSelection( focus.getShiftedBy( -1 ) );
        } );
    }, 200 );
}

/**
 *
 * @param {Object} editorInstance editor instance
 * @param {String} marker marker for autocomplete
 * @param {String} elementName element name to add
 * @param {Array} stxContent stx element content
 * @param {Object} attributes element attribute
 */
function insertStandardTextContent( editorInstance, marker, elementName, stxContent, attributes  ) {
    editorInstance._instance.model.change( writer => {
        const element = writer.createElement( elementName, attributes );
        stxContent.forEach( contentParagraph => {
            let content = contentParagraph;
            const paragraph = writer.createElement( DIVISION_ELEMENT, { content } );
            writer.append( paragraph, element );
        } );
        editorInstance._instance.model.insertContent( element );
    } );
    let data = editorInstance.getData();
    data = data.replaceAll( marker + '<', '<' );

    editorInstance.setData( data );
}
/**
 *
 * @param {Object} editorInstance editor instance
 * @param {String} imageUrl image url
 * @param {Object} datasetUid dataset uid
 */
function insertSymbol( editorInstance, imageUrl, datasetUid ) {
    const content = '<img id =' + datasetUid + ' src="' + imageUrl + '"/>';
    if ( editorInstance._instance.data ) {
        const viewFragment = editorInstance._instance.data.processor.toView( content );
        const modelFragment = editorInstance._instance.data.toModel( viewFragment );
        editorInstance._instance.model.insertContent( modelFragment );
    }
}

const exports = {
    createWiEditorInstance,
    insertContent,
    insertStandardTextContent,
    insertSymbol
};

export default exports;

