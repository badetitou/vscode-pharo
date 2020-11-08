| server |

Transcript crShow: 'Run with vscode'.

server := PLSServer new
		debugMode: false;
		enableLogging: true;
		yourself.
		
server start.