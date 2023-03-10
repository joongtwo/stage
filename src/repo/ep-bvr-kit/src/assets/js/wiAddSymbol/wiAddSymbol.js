//@<COPYRIGHT>@
//==================================================
//Copyright 2022.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@
/**
 * Placeholder plugin for parts-tools element
 */
import localeService from 'js/localeService';
import eventBus from 'js/eventBus';
import { svgString as cmdCKEditorAddSymbol } from 'image/cmdCKEditorAddSymbol16.svg';
import { ckeditor5ServiceInstance } from 'js/wiEditor.service';

export default class WIAddSymbol extends ckeditor5ServiceInstance.Plugin {
    init() {
        const editor = this.editor;
        let resource = 'InstructionsEditorMessages';
        let localTextBundle = localeService.getLoadedText( resource );

        setupCustomAttributeConversion( 'img', 'imageInline', editor );

        editor.ui.componentFactory.add( 'wiAddSymbol', locale => {
            const buttonView = new ckeditor5ServiceInstance.ButtonView( locale );

            buttonView.set( {
                label: localTextBundle.insertSymbol,
                tooltip: true,
                icon: cmdCKEditorAddSymbol
            } );

            // Callback executed once the image is clicked.
            buttonView.on( 'execute', () => {
                let form = document.createElement( 'form' );
                form.setAttribute( 'id', 'fileUploadForm' );

                let input = document.createElement( 'input' );
                form.appendChild( input );


                input.setAttribute( 'type', 'file' );
                input.setAttribute( 'id', 'fmsFile' );
                input.setAttribute( 'name', 'fmsFile' );

                input.setAttribute( 'accept', 'image/x-png,image/gif,image/jpeg,image/jpg' );

                input.addEventListener( 'change', function( data ) {
                    let file = this.files[0];
                    if ( file ) {
                        let eventData = {
                            clientid: this.value,
                            file: file,
                            form: this.form
                        };
                        eventBus.publish( 'wi.AddSymbolInInstructions', eventData );
                    }
                }, false );

                input.click();
            } );

            return buttonView;
        } );
    }
}
/**
 * @param {String} viewElementName view element name
 * @param {String} modelElementName model element name
 * @param {Object} editor editor
 */
function setupCustomAttributeConversion( viewElementName, modelElementName, editor ) {
    editor.conversion.for( 'upcast' ).add( upcastAttribute( viewElementName ) );
    editor.conversion.for( 'downcast' ).add( downcastAttribute( modelElementName, viewElementName ) );
}
/**
 * @param {String} viewElementName view element name
 * @returns {Function} dispatcher
 */
function upcastAttribute( viewElementName ) {
    return dispatcher => dispatcher.on( `element:${viewElementName}`, ( evt, data, conversionApi ) => {
        const viewItem = data.viewItem;
        const modelRange = data.modelRange;

        const modelElement = modelRange && modelRange.start.nodeAfter;

        if( !modelElement ) {
            return;
        }
        conversionApi.writer.setAttribute( 'id', viewItem.getAttribute( 'id' ), modelElement );
        conversionApi.writer.setAttribute( 'style', 'max-height:64px', modelElement );
    } );
}


/**
 * @param {String} modelElementName model element name
 * @returns {Function} dispatcher
 */
function downcastAttribute( modelElementName, viewElementName ) {
    return dispatcher => dispatcher.on( `insert:${modelElementName}`, ( evt, data, conversionApi ) => {
        const modelElement = data.item;

        const viewFigure = conversionApi.mapper.toViewElement( modelElement );
        const viewChildren = [ ...conversionApi.writer.createRangeIn( viewFigure ).getItems() ];
        const viewElement =  viewChildren.find( item => item.is( 'element', viewElementName ) );

        if( !viewElement ) {
            return;
        }
        conversionApi.writer.setAttribute( 'id', modelElement.getAttribute( 'id' ), viewElement );
        conversionApi.writer.setAttribute( 'style', 'max-height:64px', viewElement );
    } );
}
