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
		if (target) {
			// If targeting yourself just transform back.
			tActor = target.actor;
			if (tActor.uuid == actor.uuid)
				target = null;
			if (!game.keyboard.isModifierActive(KeyboardManager.MODIFIER_KEYS.SHIFT))
				target = null;
		}

		if (!target) {
			let targetUuid = actor.getFlag('trans-char', 'uuid');
			if (!targetUuid) {
				ui.notifications.warn('You must select a target token to transform into. Target the token and hold Shift, then execute the Transform macro.');
				return;
			}
			let [str, uuid] = targetUuid.split('.');
			tActor = game.actors.get(uuid);
			if (!tActor) {
				ui.notifications.warn('The previously selected actor does not exist.');
				return;
			}
		} else {
			const confirmation = await Dialog.confirm({
			  title: "Perform Transformation?",
			  content: `<p>Transform ${actor.name} into ${tActor.name}?</p><p></p>`,
			  yes: (html) => { return true; },
			  no: (html) => { return false; },
			});			
			if (!confirmation)
				return;
			
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

		let tDoc = null;
		if (!target) {
			// Create a token for the transformed actor and delete the current token.
			tDoc = await tActor.getTokenDocument({ x: token.x, y: token.y });
			let targets = await canvas.scene.createEmbeddedDocuments('Token', [tDoc]);
			target = targets[0];
		} else {
			// Move the token transformed into to the current token's location.
			target.document.update({"x": token.x, "y": token.y});
			tDoc = target.document;
		}
		/*
		let combat = game.combats.find(c => c.scene._id == canvas.scene.id);
		let combatants = combat.combatants.filter(c => c.tokenId == token.id);
		for (let combatant of combatants) {
			await combatant.update({
				"_id": combatant.id,
				"tokenId": target.id,
				"actorId": target.actorId
			});
		}
		*/
		await this.swapTokensInCombat(token, target);
		ChatMessage.create({
			content: `${token.name} has transformed into ${target.name}.`
		});
		await canvas.scene.deleteEmbeddedDocuments('Token', [token.id]);
	}

    async swapTokensInCombat(currentToken, newToken) {
        let combats = game.combats.filter(c => c.combatants.find(c => c.tokenId == currentToken.id));
        if (combats.length > 0) {
            let combatUpdateData = [];
            for (let combat of combats) {
                let combatants = combat.combatants.filter(c => c.tokenId == currentToken.id);
                let combatantUpdateData = [];
                for (let combatant of combatants) {
                    combatantUpdateData.push({
                        _id: combatant.id,
                        tokenId: newToken.id,
                        sceneId: currentToken.parent.id,
                        actorId: newToken.actor.id,
                    });
                }

                combatUpdateData.push({
                    combatId: combat.id,
                    combatantUpdateData: combatantUpdateData,
                });
            }
            await game.swadeShapeChanger.socket.executeAsGM("updateCombatant", combatUpdateData);
		}
	}

	async healTarget() {
		if (game.user.targets.size != 1) {
		  ui.notifications.warn('You must target exactly one token to heal.');
		  return;
		}

		let token = game.user.targets.first();
		if (token.actor.system.wounds.value <= 0) {
			ui.notifications.notify(`${token.name} has no wounds to heal.`);
			return;
		}

		await TransformCharacter.socket.executeAsGM("healTargetGM", game.user.id, token.scene._id, token.id);
	}

	static {
		console.log("trans-char | Swade Transform character loaded.");

		Hooks.on("init", function() {
			console.log("trans-char | Swade Transform character initialized.");
			if (!game.swadeTransformChar) {
				game.swadeTransformChar = new TransformCharacter();
				CONFIG.TransformChar = {transform: game.swadeTransformChar.transform};
			}
		});

		Hooks.on("ready", function() {
		  console.log("trans-char | Swade Transform character ready to accept game data.");
		});

		let socket;
		
		Hooks.once("socketlib.ready", () => {
			TransformCharacter.socket = socketlib.registerModule("trans-char");
			TransformCharacter.socket.register("healTargetGM", healTargetGM);
		});

		function healTargetGM(playerID, sceneID, tokenID) {
			let scene = game.scenes.get(sceneID);
			let token = scene.tokens.get(tokenID);
			let actor = token.actor;

			console.log(`Healing ${token.name}`);
			const wounds = 1;
			const currentWounds = actor.system.wounds.value
			const newWounds = Math.max(currentWounds - wounds, 0)
			if (newWounds <= actor.system.wounds.max) {
				actor.update({"system.wounds.value": newWounds})
				let chatData = {
					user: playerID,
					content: `${token.name} healed for one wound.`
				};
				ChatMessage.create(chatData);
			} else {
				actor.update({"system.wounds.value": actor.system.wounds.max})
				const incap = game.swade.util.getStatusEffectDataById('incapacitated', {active: true})
				actor.toggleActiveEffect(incap)
			}
		}

	}
}

