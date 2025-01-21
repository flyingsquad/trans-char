/**	Perform standard point buy method for character abilities.
 */
 
export class TransformCharacter {

	async transform(token) {
		if (!token) {
			ui.notifications.warn('You must select an actor to transform.');
			return;
		}
		let actor = token.actor;
		let target = game.user.targets.first();
	
		let tActor = null;

		if (!target) {
			let targetUuid = actor.getFlag('trans-char', 'uuid');
			if (!targetUuid) {
				ui.notifications.warn('You must select a target token to transform into.');
				return;
			}
			let [str, uuid] = targetUuid.split('.');
			tActor = game.actors.get(uuid);
			if (!tActor) {
				ui.notifications.warn('The previously selected actor does not exist.');
				return;
			}
		} else {
			tActor = target.actor;
			if (tActor.uuid == actor.uuid) {
				ui.notifications.warn(`The ${actor.name} token can't transform into itself.`);
				return;
			}
			await actor.setFlag('trans-char', 'uuid', tActor.uuid);
			await tActor.setFlag('trans-char', 'uuid', actor.uuid);
		}
		console.log(`${actor.name} => ${tActor.name}`);
		await tActor.update({"system.bennies": actor.system.bennies,
			"system.fatigue.value": actor.system.fatigue.value,
			"system.wounds.value": actor.system.wounds.value});
			/*
			  "system.status.isShaken": actor.system.status.isShaken,
			  "system.status.isDistracted": actor.system.status.isDistracted,
			  "system.status.isEntangled": actor.system.status.isEntangled,
			  "system.status.isIncapacitated": actor.system.status.isIncapacitated,
			  "system.status.isShaken": actor.system.status.isShaken,
			  "system.status.isStunned": actor.system.status.isStunned,
			  "system.status.isBound": actor.system.status.isBound
			*/
		if (actor.system.status.isShaken != tActor.system.status.isShaken) {
			const shaken = game.swade.util.getStatusEffectDataById('shaken', {active: actor.system.status.isShaken});
			await tActor.toggleActiveEffect(shaken);
		}
		let stat;
		if (actor.system.isIncapacitated != tActor.system.isIncapacitated) {
			stat = game.swade.util.getStatusEffectDataById('incapacitated', {active: actor.system.isIncapacitated});
			await tActor.toggleActiveEffect(stat);
		}
		if (actor.system.status.isStunned != tActor.system.status.isStunned) {
			stat = game.swade.util.getStatusEffectDataById('stunned', {active: actor.system.status.isStunned});
			await tActor.toggleActiveEffect(stat);
		}
		if (actor.system.status.isBound != tActor.system.status.isBound) {
			stat = game.swade.util.getStatusEffectDataById('bound', {active: actor.system.status.isBound});
			await tActor.toggleActiveEffect(stat);
		}
		if (actor.system.status.isEntangled != tActor.system.status.isEntangled) {
			stat = game.swade.util.getStatusEffectDataById('entangled', {active: actor.system.status.isEntangled});
			await tActor.toggleActiveEffect(stat);
		}
		if (actor.system.status.isDistracted != tActor.system.status.isDistracted) {
			stat = game.swade.util.getStatusEffectDataById('distracted', {active: actor.system.status.isDistracted});
			await tActor.toggleActiveEffect(stat);
		}
		if (actor.system.status.isVulnerable != tActor.system.status.isVulnerable) {
			stat = game.swade.util.getStatusEffectDataById('vulnerable', {active: actor.system.status.isVulnerable});
			await tActor.toggleActiveEffect(stat);
		}

		if (!target) {
			// Create a token for the transformed actor and delete the current token.
			const tDoc = await tActor.getTokenDocument({ x: token.x, y: token.y });
			await canvas.scene.createEmbeddedDocuments('Token', [tDoc]);
			await canvas.scene.deleteEmbeddedDocuments('Token', [token.id]);
		} else {
			// Move the token transformed into to the current token's location.
			target.document.update({"x": token.x, "y": token.y});
			await canvas.scene.deleteEmbeddedDocuments('Token', [token.id]);			
		}
	}

	static {
		console.log("swade-charcheck | Swade Character Check loaded.");

		Hooks.on("init", function() {
			console.log("swade-charcheck | Swade Character Check initialized.");
			if (!game.swadeTransformChar) {
				game.swadeTransformChar = new TransformCharacter();
				CONFIG.TransformChar = {transform: game.swadeTranformChar.transform};
			}
		});

		Hooks.on("ready", function() {
		  console.log("swade-charcheck | Swade Character Check ready to accept game data.");
		});
	}
}

