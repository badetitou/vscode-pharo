| server |

Transcript crShow: 'Run with vscode'.

server := PLSServer new
		debugMode: true;
		enableLogging: false;
		yourself.
		
server start.