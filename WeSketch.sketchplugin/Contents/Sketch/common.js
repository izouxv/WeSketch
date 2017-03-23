@import "MochaJSDelegate.js";

var kPluginDomain;

function initDefaults(pluginDomain, initialValues) {
	kPluginDomain = pluginDomain

	var defaults = [[NSUserDefaults standardUserDefaults] objectForKey:kPluginDomain]
	var defaultValues = {}
    var dVal;

    for (var key in defaults) {
    	defaultValues[key] = defaults[key]
	}

	for (var key in initialValues) {
		dVal = defaultValues[key]
		if (dVal == nil) defaultValues[key] = initialValues[key]
	}

	return defaultValues
}

function rgb(a){
	var sColor = a.toLowerCase();
	if(sColor.length === 4){
		var sColorNew = "#";
		for(var i=1; i<4; i+=1){
			sColorNew += sColor.slice(i,i+1).concat(sColor.slice(i,i+1));	
		}
		sColor = sColorNew;
	}
	//处理六位的颜色值
	var sColorChange = [];
	for(var i=1; i<7; i+=2){
		sColorChange.push(parseInt("0x"+sColor.slice(i,i+2)));	
	}
	return sColorChange;
}

function saveDefaults(newValues) {
	if (kPluginDomain) {
		var defaults = [NSUserDefaults standardUserDefaults]
		[defaults setObject: newValues forKey: kPluginDomain];
	}
}

function request(args) {
  var aara = [args];
  var task = NSTask.alloc().init();
  task.setLaunchPath("/usr/bin/curl");
  task.setArguments(aara);
  var outputPipe = [NSPipe pipe];
  [task setStandardOutput:outputPipe];
  task.launch();
  var responseData = [[outputPipe fileHandleForReading] readDataToEndOfFile];
  return responseData;
}
function networkRequest(args) {
  var task = NSTask.alloc().init();
  task.setLaunchPath("/usr/bin/curl");
  task.setArguments(args);
  var outputPipe = [NSPipe pipe];
  [task setStandardOutput:outputPipe];
  task.launch();
  var responseData = [[outputPipe fileHandleForReading] readDataToEndOfFile];
  return responseData;
}

function getConfig(json,context) {
		var manifestPath = context.plugin.url().URLByAppendingPathComponent("Contents").URLByAppendingPathComponent("Sketch").URLByAppendingPathComponent(json+".json").path();
		return NSJSONSerialization.JSONObjectWithData_options_error(NSData.dataWithContentsOfFile(manifestPath), NSJSONReadingMutableContainers, nil);
}

function openUrlInBrowser(url) {
    NSWorkspace.sharedWorkspace().openURL(NSURL.URLWithString(url));
}

function createRadioButtons(options, selectedItem) {
    var rows = Math.ceil(options.length / 2);
    var columns = ((options.length < 2) ? 1 : 2);
    
    var selectedRow = Math.floor(selectedItem / 2);
    var selectedColumn = selectedItem - (selectedRow * 2);
    
    var buttonCell = [[NSButtonCell alloc] init];
        [buttonCell setButtonType:NSRadioButton]
    
    var buttonMatrix = [[NSMatrix alloc] initWithFrame: NSMakeRect(20.0, 20.0, 300.0, rows * 25) mode:NSRadioModeMatrix prototype:buttonCell numberOfRows:rows numberOfColumns:columns];
        [buttonMatrix setCellSize: NSMakeSize(140, 20)];

    for (i = 0; i < options.length; i++) {
        [[[buttonMatrix cells] objectAtIndex: i] setTitle: options[i]];
        [[[buttonMatrix cells] objectAtIndex: i] setTag: i];
    }
    
	if (rows*columns > options.length) {
		[[[buttonMatrix cells] objectAtIndex:(options.length)] setTransparent: true];
		[[[buttonMatrix cells] objectAtIndex:(options.length)] setEnabled: false];

	}
    [buttonMatrix selectCellAtRow: selectedRow column: selectedColumn]
    return buttonMatrix;
}


function SMPanel(options){
    var result = false;
    options.url = encodeURI("file://" + options.url);

    var frame = NSMakeRect(0, 0, options.width, (options.height + 32)),
        titleBgColor = NSColor.colorWithRed_green_blue_alpha(0.1, 0.1, 0.1, 1),
        contentBgColor = NSColor.colorWithRed_green_blue_alpha(0.13, 0.13, 0.13, 1);

    if(options.identifier){
        options.identifier = 'com.sketchplugins.wechat.' + options.identifier;
        var threadDictionary = NSThread.mainThread().threadDictionary();
        if(threadDictionary[options.identifier]){
            return false;
        }
    }

    var Panel = NSPanel.alloc().init();
    Panel.setTitleVisibility(NSWindowTitleHidden);
    Panel.setTitlebarAppearsTransparent(true);
    Panel.standardWindowButton(NSWindowCloseButton).setHidden(options.hiddenClose);
    Panel.standardWindowButton(NSWindowMiniaturizeButton).setHidden(true);
    Panel.standardWindowButton(NSWindowZoomButton).setHidden(true);
    Panel.setFrame_display(frame, false);
    Panel.setBackgroundColor(contentBgColor);

    var contentView = Panel.contentView(),
        webView = WebView.alloc().initWithFrame(NSMakeRect(0, 0, options.width, options.height)),
        windowObject = webView.windowScriptObject(),
        delegate = new MochaJSDelegate({
            "webView:didFinishLoadForFrame:": (function(webView, webFrame){
                    var SMAction = [
                                "function SMAction(hash, data){",
                                    "if(data){",
                                        "window.SMData = encodeURI(JSON.stringify(data));",
                                    "}",
                                    "window.location.hash = hash;",
                                "}"
                            ].join(""),
                        DOMReady = [
                                "$(",
                                    "function(){",
                                        "init(" + JSON.stringify(options.data) + ")",
                                    "}",
                                ");"
                            ].join("");

                    windowObject.evaluateWebScript(SMAction);
                    // windowObject.evaluateWebScript(language);
                    // windowObject.evaluateWebScript(DOMReady);
                }),
            "webView:didChangeLocationWithinPageForFrame:": (function(webView, webFrame){
                    var request = NSURL.URLWithString(webView.mainFrameURL()).fragment();

                    if(request == "submit"){
                        var data = JSON.parse(decodeURI(windowObject.valueForKey("SMData")));
                        options.callback(data);
                        result = true;
                        if(!options.floatWindow){
                            windowObject.evaluateWebScript("window.location.hash = 'close';");
                        }
                    }
                    else if(request == "close"){
                        if(!options.floatWindow){
                            Panel.orderOut(nil);
                            NSApp.stopModal();
                        }
                        else{
                            Panel.close();
                        }
                    }
                    else if(request == "donate"){
                        // NSWorkspace.sharedWorkspace().openURL(NSURL.URLWithString("http://utom.design/measure/donate.html?ref=update"));
                        // windowObject.evaluateWebScript("window.location.hash = 'close';");
                    }
                    else if(request == "import"){
                        // if( options.importCallback(windowObject) ){
                        //      self.message(_("Import complete!"));
                        // }
                    }
                    else if(request == "export"){
                        // if( options.exportCallback(windowObject) ){
                        //      self.message(_("Export complete!"));
                        // }
                    }
                    else if(request == "export-xml"){
                        // if( options.exportXMLCallback(windowObject) ){
                        //      self.message(_("Export complete!"));
                        // }
                    }
                    else if(request == "add"){
                        // options.addCallback(windowObject);
                    }
                    else if(request == "focus"){
                        // var point = Panel.currentEvent().locationInWindow(),
                        //     y = NSHeight(Panel.frame()) - point.y - 32;
                        // windowObject.evaluateWebScript("lookupItemInput(" + point.x + ", " + y + ")");
                    }
                    windowObject.evaluateWebScript("window.location.hash = '';");
                })
        });

    contentView.setWantsLayer(true);
    contentView.layer().setFrame( contentView.frame() );
    contentView.layer().setCornerRadius(6);
    contentView.layer().setMasksToBounds(true);

    webView.setBackgroundColor(contentBgColor);
    webView.setFrameLoadDelegate_(delegate.getClassInstance());
    webView.setMainFrameURL_(options.url);

    contentView.addSubview(webView);

    var closeButton = Panel.standardWindowButton(NSWindowCloseButton);
    closeButton.setCOSJSTargetFunction(function(sender) {
        var request = NSURL.URLWithString(webView.mainFrameURL()).fragment();

        if(options.floatWindow && request == "submit"){
            data = JSON.parse(decodeURI(windowObject.valueForKey("SMData")));
            options.callback(data);
        }

        if(options.identifier){
            threadDictionary.removeObjectForKey(options.identifier);
        }

        self.wantsStop = true;
        if(options.floatWindow){
            Panel.close();
        }
        else{
            Panel.orderOut(nil);
            NSApp.stopModal();
        }

    });
    closeButton.setAction("callAction:");

    var titlebarView = contentView.superview().titlebarViewController().view(),
        titlebarContainerView = titlebarView.superview();
    closeButton.setFrameOrigin(NSMakePoint(8, 8));
    titlebarContainerView.setFrame(NSMakeRect(0, options.height, options.width, 32));
    titlebarView.setFrameSize(NSMakeSize(options.width, 32));
    titlebarView.setTransparent(true);
    titlebarView.setBackgroundColor(titleBgColor);
    titlebarContainerView.superview().setBackgroundColor(titleBgColor);

    if(options.floatWindow){
        Panel.becomeKeyWindow();
        Panel.setLevel(NSFloatingWindowLevel);
        Panel.center();
        Panel.makeKeyAndOrderFront(nil);
        if(options.identifier){
            threadDictionary[options.identifier] = Panel;
        }
        return webView;
    }
    else{
        if(options.identifier){
            threadDictionary[options.identifier] = Panel;
        }
        NSApp.runModalForWindow(Panel);
    }

    return result;
}
