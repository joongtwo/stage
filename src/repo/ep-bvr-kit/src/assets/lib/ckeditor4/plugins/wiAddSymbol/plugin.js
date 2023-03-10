/**
 * @fileOverview The "wiAddSymbol" plugin.
 * This plugin is used to add symbols to work instructions editor.
 */

CKEDITOR.plugins.add('wiAddSymbol', {
    init: function(editor) {
        editor.addCommand('wiAddSymbol', {
            exec: function(editor) {

                var form = document.createElement("form");
                form.setAttribute("id", "fileUploadForm");

                var input = document.createElement("input");
                form.appendChild(input);


                input.setAttribute("type", "file");
                input.setAttribute("id", "fmsFile");
                input.setAttribute("name", "fmsFile");

                input.setAttribute("accept", "image/x-png,image/gif,image/jpeg,image/jpg");

                input.addEventListener('change', function(data) {
                    var file = this.files[0];
                    if (file) {
                        var eventBus = editor.eventBus;

                        var eventData = {
                            "clientid": this.value,
                            "file": file,
                            "form": this.form,
                            "selectedObject": editor.selectedObject
                        };
                        window.parent.wiEditorInstance = editor;
                        eventBus.publish('wi.AddSymbolInInstructions', eventData);


                    }

                }, false);

                input.click();
            }
        });

        editor.on('selectionChange', function(evt) {
            var myCommand = this.getCommand('wiAddSymbol');
            if (myCommand) {
                var ranges = editor.getSelection().getRanges();
                if (ranges && ranges.length > 0 && !ranges[0].checkReadOnly()) {
                    myCommand.enable();
                } else {
                    myCommand.disable();
                }
            }
        });

        editor.ui.addButton('wiAddSymbol', {
            label: 'Insert Symbol',
            command: 'wiAddSymbol',
            toolbar: 'editing',
            icon: editor.baseUrl + editor.baseUrlPath + "/image/cmdCKEditorAddSymbol16.svg"
        });
    }
});

