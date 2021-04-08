Class {
	#name: #MyClassTest,
	#superclass: #TestCase, 
	#instVars: [ ],
	#category : #'MyPackage'
}   

{ #category : #accessing }
MyClassTest >> testMethod1 [  
	^ 'hello'
]

{ #category : #accessing } 
MyClassTest >> testMethodName [
	self fail
]
